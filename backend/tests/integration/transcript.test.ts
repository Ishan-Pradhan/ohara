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
  createProgram,
  createClass,
  createSection,
  createAcademicYear,
  createCourse,
  createStudentUser,
  createTeacherUser,
  createBatch,
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

const placeAndEnroll = async (
  adminCookies: string[],
  studentId: string,
  sectionId: string,
  courseId: string,
  batchId: string,
) => {
  await request(app)
    .post('/api/v1/admin/class-memberships')
    .set('Cookie', adminCookies)
    .send({ studentId, sectionId, batchId });
  await request(app)
    .post('/api/v1/admin/enrollments')
    .set('Cookie', adminCookies)
    .send({ studentId, courseId });
};

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('Exam marks + transcript', () => {
  it('lets a teacher enter marks for their course, and rolls them up into the student transcript', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const course = await createCourse({ classId: cls.id, title: 'Physics' });
    const batch = await createBatch({ programId: program.id });
    const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    await placeAndEnroll(adminCookies, student.id, section.id, course.id, batch.id);

    const studentCookies = await signInAs(student.email, 'student');
    const teacherCookies = await signInAs(teacher.email, 'teacher');

    const termRes = await request(app)
      .post('/api/v1/exam-terms')
      .set('Cookie', adminCookies)
      .send({ name: 'First Terminal', academicYearId: year.id });
    expect(termRes.status).toBe(201);
    const examTermId = termRes.body.data.id;

    // A student can't create an exam term.
    const forbiddenCreate = await request(app)
      .post('/api/v1/exam-terms')
      .set('Cookie', studentCookies)
      .send({ name: 'Sneaky Term', academicYearId: year.id });
    expect(forbiddenCreate.status).toBe(403);

    // A student can't take attendance-style enter marks either.
    const forbiddenEntry = await request(app)
      .put(`/api/v1/courses/${course.id}/exam-marks/${examTermId}`)
      .set('Cookie', studentCookies)
      .send({ marks: [{ studentId: student.id, marksObtained: 80, maxMarks: 100 }] });
    expect(forbiddenEntry.status).toBe(403);

    // The roster shows the student with no marks yet.
    const rosterRes = await request(app)
      .get(`/api/v1/courses/${course.id}/exam-marks/${examTermId}`)
      .set('Cookie', teacherCookies);
    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.data).toEqual([
      { studentId: student.id, studentName: student.name, marksObtained: null, maxMarks: null },
    ]);

    // Teacher enters marks.
    const entryRes = await request(app)
      .put(`/api/v1/courses/${course.id}/exam-marks/${examTermId}`)
      .set('Cookie', teacherCookies)
      .send({ marks: [{ studentId: student.id, marksObtained: 85, maxMarks: 100 }] });
    expect(entryRes.status).toBe(200);
    expect(entryRes.body.data).toEqual([
      { studentId: student.id, studentName: student.name, marksObtained: 85, maxMarks: 100 },
    ]);

    // Re-submitting replaces rather than duplicating.
    const reEntryRes = await request(app)
      .put(`/api/v1/courses/${course.id}/exam-marks/${examTermId}`)
      .set('Cookie', teacherCookies)
      .send({ marks: [{ studentId: student.id, marksObtained: 90, maxMarks: 100 }] });
    expect(reEntryRes.body.data).toEqual([
      { studentId: student.id, studentName: student.name, marksObtained: 90, maxMarks: 100 },
    ]);

    // The transcript (JSON, in-app) reflects it — for admin, self, and the teaching teacher.
    for (const cookies of [adminCookies, studentCookies, teacherCookies]) {
      const rcRes = await request(app)
        .get(`/api/v1/students/${student.id}/transcript`)
        .set('Cookie', cookies);
      expect(rcRes.status).toBe(200);
      expect(rcRes.body.data.semesters).toEqual([
        {
          classId: cls.id,
          className: cls.name,
          orderIndex: cls.orderIndex,
          examTerms: [
            {
              examTermId,
              examTermName: 'First Terminal',
            },
          ],
          courses: [
            {
              courseId: course.id,
              courseTitle: 'Physics',
              marks: {
                [examTermId]: { marksObtained: 90, maxMarks: 100 },
              },
              courseTotalObtained: 90,
              courseTotalMax: 100,
              coursePercentage: 90,
            },
          ],
          totalObtained: 90,
          totalMax: 100,
          percentage: 90,
          grade: 'A',
        },
      ]);
      expect(rcRes.body.data.overallPercentage).toBe(90);
      expect(rcRes.body.data.overallGrade).toBe('A');
    }

    // An unrelated student/teacher is rejected.
    const outsiderStudent = await createStudentUser({ email: `outsider-${Date.now()}@example.com` });
    const outsiderCookies = await signInAs(outsiderStudent.email, 'student');
    const outsiderTeacher = await createTeacherUser({ email: `outsider-teacher-${Date.now()}@example.com` });
    const outsiderTeacherCookies = await signInAs(outsiderTeacher.email, 'teacher');

    const forbiddenStudent = await request(app)
      .get(`/api/v1/students/${student.id}/transcript`)
      .set('Cookie', outsiderCookies);
    expect(forbiddenStudent.status).toBe(403);

    const forbiddenTeacher = await request(app)
      .get(`/api/v1/students/${student.id}/transcript`)
      .set('Cookie', outsiderTeacherCookies);
    expect(forbiddenTeacher.status).toBe(403);

    // The PDF export carries the same data.
    const pdfRes = await request(app)
      .get(`/api/v1/students/${student.id}/transcript/pdf`)
      .set('Cookie', adminCookies);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toBe('application/pdf');
    expect(Buffer.from(pdfRes.body).subarray(0, 4).toString()).toBe('%PDF');
  });

  it("scopes a teacher's transcript view to only the courses they teach", async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const program = await createProgram({ institutionType: 'college' });
    const cls = await createClass({ programId: program.id });
    const year = await createAcademicYear({ isCurrent: true });
    const section = await createSection({ classId: cls.id, academicYearId: year.id });
    const batch = await createBatch({ programId: program.id });
    const physics = await createCourse({ classId: cls.id, title: 'Physics' });
    const chemistry = await createCourse({ classId: cls.id, title: 'Chemistry' });
    const student = await createStudentUser({ email: `student-${Date.now()}@example.com` });
    const physicsTeacher = await createTeacherUser({ email: `physics-${Date.now()}@example.com` });
    const chemistryTeacher = await createTeacherUser({ email: `chem-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: physicsTeacher.id, courseId: physics.id });
    await courseTeacherRepository.assign({ teacherId: chemistryTeacher.id, courseId: chemistry.id });
    await placeAndEnroll(adminCookies, student.id, section.id, physics.id, batch.id);
    await placeAndEnroll(adminCookies, student.id, section.id, chemistry.id, batch.id);

    const termRes = await request(app)
      .post('/api/v1/exam-terms')
      .set('Cookie', adminCookies)
      .send({ name: 'First Terminal', academicYearId: year.id });
    const examTermId = termRes.body.data.id;

    const physicsTeacherCookies = await signInAs(physicsTeacher.email, 'teacher');
    const chemistryTeacherCookies = await signInAs(chemistryTeacher.email, 'teacher');

    await request(app)
      .put(`/api/v1/courses/${physics.id}/exam-marks/${examTermId}`)
      .set('Cookie', physicsTeacherCookies)
      .send({ marks: [{ studentId: student.id, marksObtained: 70, maxMarks: 100 }] });
    await request(app)
      .put(`/api/v1/courses/${chemistry.id}/exam-marks/${examTermId}`)
      .set('Cookie', chemistryTeacherCookies)
      .send({ marks: [{ studentId: student.id, marksObtained: 60, maxMarks: 100 }] });

    const physicsView = await request(app)
      .get(`/api/v1/students/${student.id}/transcript`)
      .set('Cookie', physicsTeacherCookies);
    expect(physicsView.status).toBe(200);
    expect(physicsView.body.data.semesters[0].courses).toEqual([
      {
        courseId: physics.id,
        courseTitle: 'Physics',
        marks: {
          [examTermId]: { marksObtained: 70, maxMarks: 100 },
        },
        courseTotalObtained: 70,
        courseTotalMax: 100,
        coursePercentage: 70,
      },
    ]);

    const adminView = await request(app)
      .get(`/api/v1/students/${student.id}/transcript`)
      .set('Cookie', adminCookies);
    expect(new Set(adminView.body.data.semesters[0].courses.map((c: { courseTitle: string }) => c.courseTitle))).toEqual(
      new Set(['Physics', 'Chemistry']),
    );
  });

  it('rejects a mark for a student not enrolled in the course', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const year = await createAcademicYear({ isCurrent: true });
    const course = await createCourse();
    const teacher = await createTeacherUser({ email: `teacher-${Date.now()}@example.com` });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
    const outsider = await createStudentUser({ email: `outsider-${Date.now()}@example.com` });

    const termRes = await request(app)
      .post('/api/v1/exam-terms')
      .set('Cookie', adminCookies)
      .send({ name: 'First Terminal', academicYearId: year.id });
    const examTermId = termRes.body.data.id;

    const teacherCookies = await signInAs(teacher.email, 'teacher');
    const res = await request(app)
      .put(`/api/v1/courses/${course.id}/exam-marks/${examTermId}`)
      .set('Cookie', teacherCookies)
      .send({ marks: [{ studentId: outsider.id, marksObtained: 50, maxMarks: 100 }] });
    expect(res.status).toBe(400);
  });

  it('404s for a student with no current placement', async () => {
    const adminCookies = await signInAs('admin@example.com', 'admin');
    const student = await createStudentUser();
    const res = await request(app)
      .get(`/api/v1/students/${student.id}/transcript`)
      .set('Cookie', adminCookies);
    expect(res.status).toBe(404);
  });
});
