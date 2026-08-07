import type { Response } from 'express';

import { sequelize } from '../config/db.js';
import type { AuthRequest } from '../types/auth.types.js';
import { projectRepository } from '../repositories/projects.repository.js';
import { boardColumnRepository } from '../repositories/boardColumns.repository.js';
import { taskRepository } from '../repositories/tasks.repository.js';
import { serializeProject, serializeTask } from '../serializers/kanban.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const DEFAULT_COLUMNS = ['To do', 'In progress', 'Done'];

const findOwnedColumn = async (projectId: string, columnId: string) => {
  const column = await boardColumnRepository.findById(columnId);
  if (!column || column.projectId !== projectId) {
    throw new ApiError(404, 'Column not found');
  }
  return column;
};

const findOwnedTask = async (project: NonNullable<Awaited<ReturnType<typeof projectRepository.findById>>>, taskId: string) => {
  const task = await taskRepository.findById(taskId);
  const columnIds = new Set((project.columns ?? []).map((c) => c.id));
  if (!task || !columnIds.has(task.columnId)) {
    throw new ApiError(404, 'Task not found');
  }
  return task;
};

/** Every student's own private, non-course Kanban board for personal
 * productivity — created lazily on first visit rather than through an
 * explicit "new board" flow, since there's exactly one per student. */
export const getOrCreateMyBoard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const existing = await projectRepository.findPersonalByOwner(studentId);
    if (existing) {
      const full = await projectRepository.findById(existing.id);
      if (!full) {
        throw new ApiError(500, 'Failed to load your board');
      }
      return ok(res, serializeProject(full), 'Board retrieved');
    }

    const created = await sequelize.transaction(async (transaction) => {
      const project = await projectRepository.create(
        { type: 'personal', ownerId: studentId, name: 'My Board', createdBy: studentId },
        transaction,
      );
      await boardColumnRepository.bulkCreate(
        DEFAULT_COLUMNS.map((name, index) => ({ projectId: project.id, name, orderIndex: index })),
        transaction,
      );
      return project;
    });

    const full = await projectRepository.findById(created.id);
    if (!full) {
      throw new ApiError(500, 'Failed to load your board');
    }
    return ok(res, serializeProject(full), 'Board created', 201);
  },
);

const findMyProject = async (studentId: string) => {
  const project = await projectRepository.findPersonalByOwner(studentId);
  if (!project) {
    throw new ApiError(404, 'Board not found — visit your board once to create it');
  }
  const full = await projectRepository.findById(project.id);
  if (!full) {
    throw new ApiError(404, 'Board not found');
  }
  return full;
};

export const createMyTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { columnId } = req.validated?.params as { columnId: string };
    const { title, description } = req.validated?.body as { title: string; description?: string | null };

    const project = await findMyProject(studentId);
    await findOwnedColumn(project.id, columnId);

    const existing = await taskRepository.findByColumn(columnId);
    const created = await taskRepository.create({
      columnId,
      title,
      description: description ?? null,
      assigneeId: null,
      orderIndex: existing.length,
    });
    const task = await taskRepository.findById(created.id);
    if (!task) {
      throw new ApiError(500, 'Failed to load the task that was just created');
    }
    return ok(res, serializeTask(task), 'Task created', 201);
  },
);

export const updateMyTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { taskId } = req.validated?.params as { taskId: string };
    const body = req.validated?.body as { title?: string; description?: string | null };

    const project = await findMyProject(studentId);
    await findOwnedTask(project, taskId);

    const updated = await taskRepository.update(taskId, body);
    if (!updated) {
      throw new ApiError(404, 'Task not found');
    }
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new ApiError(404, 'Task not found');
    }
    return ok(res, serializeTask(task), 'Task updated');
  },
);

export const deleteMyTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { taskId } = req.validated?.params as { taskId: string };

    const project = await findMyProject(studentId);
    await findOwnedTask(project, taskId);
    await taskRepository.delete(taskId);
    return ok(res, null, 'Task deleted');
  },
);

export const moveMyTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { taskId } = req.validated?.params as { taskId: string };
    const { columnId: targetColumnId, orderIndex: targetIndex } = req.validated?.body as {
      columnId: string;
      orderIndex: number;
    };

    const project = await findMyProject(studentId);
    const task = await findOwnedTask(project, taskId);

    const columnIds = new Set((project.columns ?? []).map((c) => c.id));
    if (!columnIds.has(targetColumnId)) {
      throw new ApiError(400, 'That column does not belong to your board');
    }

    const sourceColumnId = task.columnId;

    await sequelize.transaction(async (transaction) => {
      const sourceTasks = (await taskRepository.findByColumn(sourceColumnId, transaction)).filter(
        (t) => t.id !== taskId,
      );
      const targetTasks =
        sourceColumnId === targetColumnId
          ? sourceTasks
          : (await taskRepository.findByColumn(targetColumnId, transaction));

      const clampedIndex = Math.max(0, Math.min(targetIndex, targetTasks.length));
      targetTasks.splice(clampedIndex, 0, task);

      for (const [index, t] of targetTasks.entries()) {
        await taskRepository.setPosition(t.id, targetColumnId, index, transaction);
      }
      if (sourceColumnId !== targetColumnId) {
        for (const [index, t] of sourceTasks.entries()) {
          await taskRepository.setPosition(t.id, sourceColumnId, index, transaction);
        }
      }
    });

    const moved = await taskRepository.findById(taskId);
    if (!moved) {
      throw new ApiError(404, 'Task not found');
    }
    return ok(res, serializeTask(moved), 'Task moved');
  },
);
