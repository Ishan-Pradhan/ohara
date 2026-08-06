import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/email.service.js', async () => {
  const { emailServiceStub } = await import('../helpers/auth.js');
  return emailServiceStub();
});

const { app } = await import('../../src/app.js');
const { truncateAll, closeDb } = await import('../helpers/db.js');
const { cookiesFrom } = await import('../helpers/auth.js');
const { User } = await import('../../src/models/users.model.js');
const {
  createCourse,
  createTeacherUser,
  createStudentUser,
  createEnrollment,
} = await import('../helpers/institution.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);

const PASSWORD = 'hunter2secret';

type Role = 'admin' | 'teacher' | 'student' | 'alumni';

const signInAs = async (email: string, role: Role): Promise<string[]> => {
  await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Test User', email, password: PASSWORD });
  await User.update({ isVerified: true, role }, { where: { email } });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  return cookiesFrom(login);
};

const setupCourseWithTeacherAndStudent = async () => {
  const course = await createCourse();
  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
  const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
  await createEnrollment({ studentId: student.id, courseId: course.id });

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  const studentCookies = await signInAs(student.email, 'student');
  return { course, teacher, student, teacherCookies, studentCookies };
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('Kanban boards', () => {
  it('creates a project with default columns, tasks, and lets the assignee (only) move their own task', async () => {
    const { course, teacherCookies, studentCookies, student } = await setupCourseWithTeacherAndStudent();

    const projectRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'Term Project' });
    expect(projectRes.status).toBe(201);
    expect(projectRes.body.data.columns.map((c: { name: string }) => c.name)).toEqual([
      'To do',
      'In progress',
      'Done',
    ]);
    const projectId = projectRes.body.data.id;
    const [todo, inProgress] = projectRes.body.data.columns;

    // Reject assigning to a student not enrolled in the course.
    const outsider = await createStudentUser({ email: `outsider-${Date.now()}@example.com` });
    const rejected = await request(app)
      .post(`/api/v1/courses/${course.id}/projects/${projectId}/columns/${todo.id}/tasks`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Bad task', assigneeId: outsider.id });
    expect(rejected.status).toBe(400);

    const task1Res = await request(app)
      .post(`/api/v1/courses/${course.id}/projects/${projectId}/columns/${todo.id}/tasks`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Write proposal', description: 'First draft', assigneeId: student.id });
    expect(task1Res.status).toBe(201);
    expect(task1Res.body.data.assigneeName).toBe(student.name);
    const task1Id = task1Res.body.data.id;

    const task2Res = await request(app)
      .post(`/api/v1/courses/${course.id}/projects/${projectId}/columns/${todo.id}/tasks`)
      .set('Cookie', teacherCookies)
      .send({ title: 'Unassigned task' });
    const task2Id = task2Res.body.data.id;

    // The student can't move the unassigned task (not theirs).
    const forbiddenMove = await request(app)
      .patch(`/api/v1/courses/${course.id}/projects/${projectId}/tasks/${task2Id}/move`)
      .set('Cookie', studentCookies)
      .send({ columnId: inProgress.id, orderIndex: 0 });
    expect(forbiddenMove.status).toBe(403);

    // The student CAN move their own task across columns.
    const moveRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/projects/${projectId}/tasks/${task1Id}/move`)
      .set('Cookie', studentCookies)
      .send({ columnId: inProgress.id, orderIndex: 0 });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.columnId).toBe(inProgress.id);
    expect(moveRes.body.data.orderIndex).toBe(0);

    const afterMove = await request(app)
      .get(`/api/v1/courses/${course.id}/projects/${projectId}`)
      .set('Cookie', teacherCookies);
    const todoAfter = afterMove.body.data.columns.find((c: { id: string }) => c.id === todo.id);
    const inProgressAfter = afterMove.body.data.columns.find((c: { id: string }) => c.id === inProgress.id);
    expect(todoAfter.tasks.map((t: { id: string }) => t.id)).toEqual([task2Id]);
    expect(todoAfter.tasks[0].orderIndex).toBe(0); // reindexed after task1 left
    expect(inProgressAfter.tasks.map((t: { id: string }) => t.id)).toEqual([task1Id]);

    // The teacher may move any task, including the unassigned one.
    const teacherMove = await request(app)
      .patch(`/api/v1/courses/${course.id}/projects/${projectId}/tasks/${task2Id}/move`)
      .set('Cookie', teacherCookies)
      .send({ columnId: inProgress.id, orderIndex: 0 });
    expect(teacherMove.status).toBe(200);

    // Student is rejected from creating/editing/deleting.
    const studentCreate = await request(app)
      .post(`/api/v1/courses/${course.id}/projects/${projectId}/columns/${todo.id}/tasks`)
      .set('Cookie', studentCookies)
      .send({ title: 'Nope' });
    expect(studentCreate.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/v1/courses/${course.id}/projects/${projectId}/tasks/${task2Id}`)
      .set('Cookie', teacherCookies);
    expect(deleteRes.status).toBe(200);
  });

  it('preserves order within a column when reordering', async () => {
    const { course, teacherCookies } = await setupCourseWithTeacherAndStudent();
    const projectRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'Reorder Project' });
    const projectId = projectRes.body.data.id;
    const todo = projectRes.body.data.columns[0];

    const titles = ['A', 'B', 'C'];
    const ids: string[] = [];
    for (const title of titles) {
      const res = await request(app)
        .post(`/api/v1/courses/${course.id}/projects/${projectId}/columns/${todo.id}/tasks`)
        .set('Cookie', teacherCookies)
        .send({ title });
      ids.push(res.body.data.id);
    }

    // Move the last task ("C") to the front.
    await request(app)
      .patch(`/api/v1/courses/${course.id}/projects/${projectId}/tasks/${ids[2]}/move`)
      .set('Cookie', teacherCookies)
      .send({ columnId: todo.id, orderIndex: 0 });

    const res = await request(app)
      .get(`/api/v1/courses/${course.id}/projects/${projectId}`)
      .set('Cookie', teacherCookies);
    const column = res.body.data.columns.find((c: { id: string }) => c.id === todo.id);
    expect(column.tasks.map((t: { id: string }) => t.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(column.tasks.map((t: { orderIndex: number }) => t.orderIndex)).toEqual([0, 1, 2]);
  });

  it('rejects a student trying to create a project or delete a column', async () => {
    const { course, teacherCookies, studentCookies } = await setupCourseWithTeacherAndStudent();
    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', studentCookies)
      .send({ name: 'Nope' });
    expect(createRes.status).toBe(403);

    const projectRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'P' });
    const columnId = projectRes.body.data.columns[0].id;
    const deleteRes = await request(app)
      .delete(`/api/v1/courses/${course.id}/projects/${projectRes.body.data.id}/columns/${columnId}`)
      .set('Cookie', studentCookies);
    expect(deleteRes.status).toBe(403);
  });
});
