import type { Response } from 'express';

import { sequelize } from '../config/db.js';
import type { AuthRequest } from '../types/auth.types.js';
import type { User } from '../models/users.model.js';
import type { Project } from '../models/projects.model.js';
import { projectRepository } from '../repositories/projects.repository.js';
import { boardColumnRepository } from '../repositories/boardColumns.repository.js';
import { taskRepository } from '../repositories/tasks.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { projectMemberRepository } from '../repositories/projectMembers.repository.js';
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

/** Route middleware already confirmed admin / an assigned course teacher /
 * an enrolled student. The remaining gap is students: only a project's
 * members (not every enrolled student) may see or work its board — a
 * 404 on view (not 403) so membership isn't leaked to non-members. */
const assertCanViewProject = async (user: User, project: Project) => {
  if (user.role !== 'student') return;
  const isMember = await projectMemberRepository.isMember(project.id, user.id);
  if (!isMember) {
    throw new ApiError(404, 'Project not found');
  }
};

const assertCanManageTasks = async (user: User, project: Project) => {
  if (user.role !== 'student') return;
  const isMember = await projectMemberRepository.isMember(project.id, user.id);
  if (!isMember) {
    throw new ApiError(403, 'Not a member of this project');
  }
};

export const createProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { name, memberIds } = req.validated?.body as { name: string; memberIds: string[] };
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Unauthorized');
    }

    for (const studentId of memberIds) {
      const enrolled = await enrollmentRepository.isEnrolled(studentId, courseId);
      if (!enrolled) {
        throw new ApiError(400, `Student ${studentId} is not enrolled in this course`);
      }
    }

    const project = await sequelize.transaction(async (transaction) => {
      const created = await projectRepository.create(
        { courseId, type: 'course', name, createdBy: teacherId },
        transaction,
      );
      await boardColumnRepository.bulkCreate(
        DEFAULT_COLUMNS.map((columnName, index) => ({
          projectId: created.id,
          name: columnName,
          orderIndex: index,
        })),
        transaction,
      );
      await projectMemberRepository.replaceForProject(created.id, memberIds, transaction);
      return created;
    });

    const full = await projectRepository.findById(project.id);
    if (!full) {
      throw new ApiError(500, 'Failed to load the project that was just created');
    }
    return ok(res, serializeProject(full), 'Project created', 201);
  },
);

export const updateProjectMembers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: projectId } = req.validated?.params as { courseId: string; id: string };
    const { memberIds } = req.validated?.body as { memberIds: string[] };
    await findOwnedProject(courseId, projectId);

    for (const studentId of memberIds) {
      const enrolled = await enrollmentRepository.isEnrolled(studentId, courseId);
      if (!enrolled) {
        throw new ApiError(400, `Student ${studentId} is not enrolled in this course`);
      }
    }

    await projectMemberRepository.replaceForProject(projectId, memberIds);
    const full = await projectRepository.findById(projectId);
    if (!full) {
      throw new ApiError(404, 'Project not found');
    }
    return ok(res, serializeProject(full), 'Project members updated');
  },
);

export const listProjects = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const projects = await projectRepository.findAllByCourse(courseId);
    const visible =
      user.role === 'student'
        ? projects.filter((p) => (p.members ?? []).some((m) => m.studentId === user.id))
        : projects;
    return ok(res, visible.map(serializeProjectSummary), 'Projects retrieved');
  },
);

export const getProject = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const project = await findOwnedProject(courseId, id);
    await assertCanViewProject(user, project);
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
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const project = await findOwnedProject(courseId, projectId);
    await assertCanManageTasks(user, project);
    const column = await findOwnedColumn(courseId, projectId, columnId);

    if (assigneeId) {
      const isMember = await projectMemberRepository.isMember(projectId, assigneeId);
      if (!isMember) {
        throw new ApiError(400, 'Assignee is not a member of this project');
      }
    }

    const existing = await taskRepository.findByColumn(column.id);
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
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const project = await findOwnedProject(courseId, projectId);
    await assertCanManageTasks(user, project);
    await findOwnedTask(courseId, projectId, taskId);

    if (body.assigneeId) {
      const isMember = await projectMemberRepository.isMember(projectId, body.assigneeId);
      if (!isMember) {
        throw new ApiError(400, 'Assignee is not a member of this project');
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
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const project = await findOwnedProject(courseId, projectId);
    await assertCanManageTasks(user, project);
    await findOwnedTask(courseId, projectId, taskId);
    await taskRepository.delete(taskId);
    return ok(res, null, 'Task deleted');
  },
);

/** FR-39, redesigned: a project's members split and manage their own work
 * — any member may move any task on their project's board, not just the
 * one they're assigned to (a teacher/admin may always move any task too). */
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
    await assertCanManageTasks(user, project);
    const task = await findOwnedTask(courseId, projectId, taskId);

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
