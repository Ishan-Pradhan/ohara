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

/** A course with a teacher and two enrolled students — only `memberStudent`
 * is later put on the project roster, `outsiderStudent` stays enrolled but
 * not a member, so tests can tell "enrolled" and "project member" apart. */
const setupCourseWithTeacherAndTwoStudents = async () => {
  const course = await createCourse();
  const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
  await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
  const memberStudent = await createStudentUser({ email: `member-${Date.now()}@example.com` });
  const outsiderStudent = await createStudentUser({ email: `outsider-${Date.now()}@example.com` });
  await createEnrollment({ studentId: memberStudent.id, courseId: course.id });
  await createEnrollment({ studentId: outsiderStudent.id, courseId: course.id });

  const teacherCookies = await signInAs(teacher.email, 'teacher');
  const memberCookies = await signInAs(memberStudent.email, 'student');
  const outsiderCookies = await signInAs(outsiderStudent.email, 'student');
  return { course, teacher, memberStudent, outsiderStudent, teacherCookies, memberCookies, outsiderCookies };
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('Kanban team projects', () => {
  it('creates a project with a member roster; only members can see or work the board', async () => {
    const { course, teacherCookies, memberStudent, memberCookies, outsiderCookies } =
      await setupCourseWithTeacherAndTwoStudents();

    // Reject a roster containing a student not enrolled in the course.
    const notEnrolled = await createStudentUser({ email: `not-enrolled-${Date.now()}@example.com` });
    const rejectedCreate = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'Term Project', memberIds: [notEnrolled.id] });
    expect(rejectedCreate.status).toBe(400);

    const projectRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'Term Project', memberIds: [memberStudent.id] });
    expect(projectRes.status).toBe(201);
    expect(projectRes.body.data.columns.map((c: { name: string }) => c.name)).toEqual([
      'To do',
      'In progress',
      'Done',
    ]);
    expect(projectRes.body.data.members).toEqual([{ id: memberStudent.id, name: memberStudent.name }]);
    const projectId = projectRes.body.data.id;

    // The member can view it.
    const memberView = await request(app)
      .get(`/api/v1/courses/${course.id}/projects/${projectId}`)
      .set('Cookie', memberCookies);
    expect(memberView.status).toBe(200);

    // An enrolled-but-not-a-member student gets a 404 (existence not leaked).
    const outsiderView = await request(app)
      .get(`/api/v1/courses/${course.id}/projects/${projectId}`)
      .set('Cookie', outsiderCookies);
    expect(outsiderView.status).toBe(404);

    // listProjects: the member sees it, the outsider does not.
    const memberList = await request(app)
      .get(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', memberCookies);
    expect(memberList.body.data.map((p: { id: string }) => p.id)).toEqual([projectId]);

    const outsiderList = await request(app)
      .get(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', outsiderCookies);
    expect(outsiderList.body.data).toEqual([]);
  });

  it('lets any project member create, assign, edit, move, and delete tasks — not just the teacher', async () => {
    const { course, teacherCookies, memberStudent, memberCookies, outsiderStudent, outsiderCookies } =
      await setupCourseWithTeacherAndTwoStudents();

    const projectRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'Group Work', memberIds: [memberStudent.id] });
    const projectId = projectRes.body.data.id;
    const [todo, inProgress] = projectRes.body.data.columns;

    // The member creates their own task and self-assigns — "split their
    // work and assign what to do by themself instead of teachers".
    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects/${projectId}/columns/${todo.id}/tasks`)
      .set('Cookie', memberCookies)
      .send({ title: 'Write proposal', assigneeId: memberStudent.id });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.assigneeName).toBe(memberStudent.name);
    const taskId = createRes.body.data.id;

    // Assigning to someone not on the roster (even though enrolled) is rejected.
    const badAssign = await request(app)
      .post(`/api/v1/courses/${course.id}/projects/${projectId}/columns/${todo.id}/tasks`)
      .set('Cookie', memberCookies)
      .send({ title: 'Bad assign', assigneeId: outsiderStudent.id });
    expect(badAssign.status).toBe(400);

    // A non-member (even though enrolled in the course) cannot touch tasks.
    const outsiderCreate = await request(app)
      .post(`/api/v1/courses/${course.id}/projects/${projectId}/columns/${todo.id}/tasks`)
      .set('Cookie', outsiderCookies)
      .send({ title: 'Nope' });
    expect(outsiderCreate.status).toBe(403);

    // The member moves the task themself — no assignee-only restriction anymore.
    const moveRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/projects/${projectId}/tasks/${taskId}/move`)
      .set('Cookie', memberCookies)
      .send({ columnId: inProgress.id, orderIndex: 0 });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.columnId).toBe(inProgress.id);

    // The member edits and deletes it too.
    const updateRes = await request(app)
      .patch(`/api/v1/courses/${course.id}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', memberCookies)
      .send({ title: 'Write proposal v2' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.title).toBe('Write proposal v2');

    const deleteRes = await request(app)
      .delete(`/api/v1/courses/${course.id}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', memberCookies);
    expect(deleteRes.status).toBe(200);
  });

  it('lets the teacher replace the member roster, and rejects a student changing it', async () => {
    const { course, teacherCookies, memberStudent, outsiderStudent, memberCookies, outsiderCookies } =
      await setupCourseWithTeacherAndTwoStudents();

    const projectRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'Group Work', memberIds: [memberStudent.id] });
    const projectId = projectRes.body.data.id;

    const rejected = await request(app)
      .put(`/api/v1/courses/${course.id}/projects/${projectId}/members`)
      .set('Cookie', memberCookies)
      .send({ memberIds: [memberStudent.id, outsiderStudent.id] });
    expect(rejected.status).toBe(403);

    const updateRes = await request(app)
      .put(`/api/v1/courses/${course.id}/projects/${projectId}/members`)
      .set('Cookie', teacherCookies)
      .send({ memberIds: [outsiderStudent.id] });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.members).toEqual([{ id: outsiderStudent.id, name: outsiderStudent.name }]);

    // The old member lost access; the newly added one has it.
    const oldMemberView = await request(app)
      .get(`/api/v1/courses/${course.id}/projects/${projectId}`)
      .set('Cookie', memberCookies);
    expect(oldMemberView.status).toBe(404);

    const newMemberView = await request(app)
      .get(`/api/v1/courses/${course.id}/projects/${projectId}`)
      .set('Cookie', outsiderCookies);
    expect(newMemberView.status).toBe(200);
  });

  it('preserves order within a column when reordering', async () => {
    const { course, teacherCookies, memberStudent } = await setupCourseWithTeacherAndTwoStudents();
    const projectRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'Reorder Project', memberIds: [memberStudent.id] });
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
    const { course, teacherCookies, memberCookies, memberStudent } = await setupCourseWithTeacherAndTwoStudents();
    const createRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', memberCookies)
      .send({ name: 'Nope', memberIds: [memberStudent.id] });
    expect(createRes.status).toBe(403);

    const projectRes = await request(app)
      .post(`/api/v1/courses/${course.id}/projects`)
      .set('Cookie', teacherCookies)
      .send({ name: 'P', memberIds: [memberStudent.id] });
    const columnId = projectRes.body.data.columns[0].id;
    const deleteRes = await request(app)
      .delete(`/api/v1/courses/${course.id}/projects/${projectRes.body.data.id}/columns/${columnId}`)
      .set('Cookie', memberCookies);
    expect(deleteRes.status).toBe(403);
  });
});

describe('Personal Kanban boards', () => {
  it("creates a student's board lazily, is private to them, and supports full task CRUD + move", async () => {
    const student = await createStudentUser({ email: `personal-${Date.now()}@example.com` });
    const otherStudent = await createStudentUser({ email: `other-${Date.now()}@example.com` });
    const studentCookies = await signInAs(student.email, 'student');
    const otherCookies = await signInAs(otherStudent.email, 'student');
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    // A teacher has no personal board.
    const teacherRejected = await request(app).get('/api/v1/me/kanban/board').set('Cookie', teacherCookies);
    expect(teacherRejected.status).toBe(403);

    const firstVisit = await request(app).get('/api/v1/me/kanban/board').set('Cookie', studentCookies);
    expect(firstVisit.status).toBe(201);
    expect(firstVisit.body.data.type).toBe('personal');
    expect(firstVisit.body.data.columns.map((c: { name: string }) => c.name)).toEqual([
      'To do',
      'In progress',
      'Done',
    ]);
    const [todo, inProgress] = firstVisit.body.data.columns;

    // Visiting again returns the same board, not a second one.
    const secondVisit = await request(app).get('/api/v1/me/kanban/board').set('Cookie', studentCookies);
    expect(secondVisit.status).toBe(200);
    expect(secondVisit.body.data.id).toBe(firstVisit.body.data.id);

    const createRes = await request(app)
      .post(`/api/v1/me/kanban/columns/${todo.id}/tasks`)
      .set('Cookie', studentCookies)
      .send({ title: 'Revise notes' });
    expect(createRes.status).toBe(201);
    const taskId = createRes.body.data.id;

    // Another student can't see or touch this board — its columnId belongs to someone else's board.
    const otherBoard = await request(app).get('/api/v1/me/kanban/board').set('Cookie', otherCookies);
    expect(otherBoard.body.data.id).not.toBe(firstVisit.body.data.id);
    const otherCreate = await request(app)
      .post(`/api/v1/me/kanban/columns/${todo.id}/tasks`)
      .set('Cookie', otherCookies)
      .send({ title: 'Should fail' });
    expect(otherCreate.status).toBe(404);
    const otherDelete = await request(app)
      .delete(`/api/v1/me/kanban/tasks/${taskId}`)
      .set('Cookie', otherCookies);
    expect(otherDelete.status).toBe(404);

    const moveRes = await request(app)
      .patch(`/api/v1/me/kanban/tasks/${taskId}/move`)
      .set('Cookie', studentCookies)
      .send({ columnId: inProgress.id, orderIndex: 0 });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.columnId).toBe(inProgress.id);

    const updateRes = await request(app)
      .patch(`/api/v1/me/kanban/tasks/${taskId}`)
      .set('Cookie', studentCookies)
      .send({ title: 'Revise notes thoroughly' });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app).delete(`/api/v1/me/kanban/tasks/${taskId}`).set('Cookie', studentCookies);
    expect(deleteRes.status).toBe(200);
  });
});
