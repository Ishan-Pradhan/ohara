import type { Response } from 'express';

import { sequelize } from '../config/db.js';
import type { AuthRequest } from '../types/auth.types.js';
import { projectRepository } from '../repositories/projects.repository.js';
import { boardColumnRepository } from '../repositories/boardColumns.repository.js';
import { taskRepository } from '../repositories/tasks.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import {
  serializeProject,
  serializeProjectSummary,
  serializeColumn,
  serializeTask,
} from '../serializers/kanban.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const DEFAULT_COLUMNS = ['To do', 'In progress', 'Done'];

const findOwnedProject = async (courseId: string, id: string) => {
  const project = await projectRepository.findById(id);
  if (!project || project.courseId !== courseId) {
    throw new ApiError(404, 'Project not found');
  }
  return project;
};

const findOwnedColumn = async (courseId: string, projectId: string, columnId: string) => {
  await findOwnedProject(courseId, projectId);
  const column = await boardColumnRepository.findById(columnId);
  if (!column || column.projectId !== projectId) {
    throw new ApiError(404, 'Column not found');
  }
  return column;
};

const findOwnedTask = async (courseId: string, projectId: string, taskId: string) => {
  const project = await findOwnedProject(courseId, projectId);
  const task = await taskRepository.findById(taskId);
  const columnIds = new Set((project.columns ?? []).map((c) => c.id));
  if (!task || !columnIds.has(task.columnId)) {
    throw new ApiError(404, 'Task not found');
  }
  return task;
};

export const createProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { name } = req.validated?.body as { name: string };
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const project = await sequelize.transaction(async (transaction) => {
      const created = await projectRepository.create({ courseId, name, createdBy: teacherId }, transaction);
      await boardColumnRepository.bulkCreate(
        DEFAULT_COLUMNS.map((columnName, index) => ({
          projectId: created.id,
          name: columnName,
          orderIndex: index,
        })),
        transaction,
      );
      return created;
    });

    const full = await projectRepository.findById(project.id);
    if (!full) {
      throw new ApiError(500, 'Failed to load the project that was just created');
    }
    return ok(res, serializeProject(full), 'Project created', 201);
  },
);

export const listProjects = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const projects = await projectRepository.findAllByCourse(courseId);
    return ok(res, projects.map(serializeProjectSummary), 'Projects retrieved');
  },
);

export const getProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const project = await findOwnedProject(courseId, id);
    return ok(res, serializeProject(project), 'Project retrieved');
  },
);

export const deleteProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    await findOwnedProject(courseId, id);
    await projectRepository.delete(id);
    return ok(res, null, 'Project deleted');
  },
);

export const createColumn = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: projectId } = req.validated?.params as { courseId: string; id: string };
    const { name } = req.validated?.body as { name: string };
    const project = await findOwnedProject(courseId, projectId);

    const nextOrderIndex = (project.columns ?? []).length;
    const column = await boardColumnRepository.create({ projectId, name, orderIndex: nextOrderIndex });
    return ok(res, serializeColumn(column), 'Column created', 201);
  },
);

export const updateColumn = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: projectId, columnId } = req.validated?.params as {
      courseId: string;
      id: string;
      columnId: string;
    };
    const { name } = req.validated?.body as { name: string };
    await findOwnedColumn(courseId, projectId, columnId);

    const column = await boardColumnRepository.update(columnId, { name });
    if (!column) {
      throw new ApiError(404, 'Column not found');
    }
    return ok(res, serializeColumn(column), 'Column updated');
  },
);

export const deleteColumn = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: projectId, columnId } = req.validated?.params as {
      courseId: string;
      id: string;
      columnId: string;
    };
    await findOwnedColumn(courseId, projectId, columnId);
    await boardColumnRepository.delete(columnId);
    return ok(res, null, 'Column deleted');
  },
);

export const createTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: projectId, columnId } = req.validated?.params as {
      courseId: string;
      id: string;
      columnId: string;
    };
    const { title, description, assigneeId } = req.validated?.body as {
      title: string;
      description?: string | null;
      assigneeId?: string | null;
    };
    await findOwnedColumn(courseId, projectId, columnId);

    if (assigneeId) {
      const enrolled = await enrollmentRepository.isEnrolled(assigneeId, courseId);
      if (!enrolled) {
        throw new ApiError(400, 'Assignee is not enrolled in this course');
      }
    }

    const existing = await taskRepository.findByColumn(columnId);
    const created = await taskRepository.create({
      columnId,
      title,
      description: description ?? null,
      assigneeId: assigneeId ?? null,
      orderIndex: existing.length,
    });
    const task = await taskRepository.findById(created.id);
    if (!task) {
      throw new ApiError(500, 'Failed to load the task that was just created');
    }
    return ok(res, serializeTask(task), 'Task created', 201);
  },
);

export const updateTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: projectId, taskId } = req.validated?.params as {
      courseId: string;
      id: string;
      taskId: string;
    };
    const body = req.validated?.body as { title?: string; description?: string | null; assigneeId?: string | null };
    await findOwnedTask(courseId, projectId, taskId);

    if (body.assigneeId) {
      const enrolled = await enrollmentRepository.isEnrolled(body.assigneeId, courseId);
      if (!enrolled) {
        throw new ApiError(400, 'Assignee is not enrolled in this course');
      }
    }

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

export const deleteTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: projectId, taskId } = req.validated?.params as {
      courseId: string;
      id: string;
      taskId: string;
    };
    await findOwnedTask(courseId, projectId, taskId);
    await taskRepository.delete(taskId);
    return ok(res, null, 'Task deleted');
  },
);

/** FR-39: the assignee moves their own task; a teacher/admin may move any
 * task on their course's board. Reindexes every task in both the source and
 * destination columns in one transaction — boards are small, so a full
 * reindex is simpler and less bug-prone than shifting individual rows. */
export const moveTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { courseId, id: projectId, taskId } = req.validated?.params as {
      courseId: string;
      id: string;
      taskId: string;
    };
    const { columnId: targetColumnId, orderIndex: targetIndex } = req.validated?.body as {
      columnId: string;
      orderIndex: number;
    };

    const project = await findOwnedProject(courseId, projectId);
    const task = await findOwnedTask(courseId, projectId, taskId);

    if (user.role === 'student' && task.assigneeId !== user.id) {
      throw new ApiError(403, 'Only the assignee can move this task');
    }

    const columnIds = new Set((project.columns ?? []).map((c) => c.id));
    if (!columnIds.has(targetColumnId)) {
      throw new ApiError(400, 'That column does not belong to this project');
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

      // A transaction pins one reserved connection — these writes must run
      // sequentially, not via Promise.all, or the driver rejects the
      // overlapping queries.
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
