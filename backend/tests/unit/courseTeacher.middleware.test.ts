import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../src/types/auth.types.js';

vi.mock('../../src/repositories/courseTeachers.repository.js', () => ({
  courseTeacherRepository: { exists: vi.fn() },
}));

const { requireCourseTeacher } = await import(
  '../../src/middlewares/auth.middleware.js'
);
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);

type MockUser = { id: string; role: string };

/** Only `user` and `params` are read by requireCourseTeacher. */
const makeReq = (user: MockUser | undefined, courseId: string): AuthRequest =>
  ({ user, params: { courseId } }) as unknown as AuthRequest;

const noopRes = {} as unknown as Response;

describe('requireCourseTeacher', () => {
  beforeEach(() => {
    vi.mocked(courseTeacherRepository.exists).mockReset();
  });

  it('throws 401 when there is no authenticated user', async () => {
    const next: NextFunction = vi.fn();
    await expect(
      requireCourseTeacher(makeReq(undefined, 'course-1'), noopRes, next),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(next).not.toHaveBeenCalled();
  });

  it('lets an admin through without checking the repository', async () => {
    const next: NextFunction = vi.fn();
    await requireCourseTeacher(
      makeReq({ id: 'admin-1', role: 'admin' }, 'course-1'),
      noopRes,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(courseTeacherRepository.exists).not.toHaveBeenCalled();
  });

  it('lets an assigned teacher through', async () => {
    vi.mocked(courseTeacherRepository.exists).mockResolvedValue(true);
    const next: NextFunction = vi.fn();
    await requireCourseTeacher(
      makeReq({ id: 'teacher-1', role: 'teacher' }, 'course-1'),
      noopRes,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(courseTeacherRepository.exists).toHaveBeenCalledWith(
      'teacher-1',
      'course-1',
    );
  });

  it('throws 403 for an unassigned teacher', async () => {
    vi.mocked(courseTeacherRepository.exists).mockResolvedValue(false);
    const next: NextFunction = vi.fn();
    await expect(
      requireCourseTeacher(
        makeReq({ id: 'teacher-2', role: 'teacher' }, 'course-1'),
        noopRes,
        next,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(next).not.toHaveBeenCalled();
  });
});
