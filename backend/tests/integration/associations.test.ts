import { describe, it, expect, beforeEach, afterAll } from 'vitest';

const { truncateAll, closeDb } = await import('../helpers/db.js');
const {
  createProgram,
  createClass,
  createSection,
  createBatch,
  createCourse,
  createTeacherUser,
} = await import('../helpers/institution.js');
const { Class } = await import('../../src/models/classes.model.js');
const { Program } = await import('../../src/models/programs.model.js');
const { Section } = await import('../../src/models/sections.model.js');
const { Course } = await import('../../src/models/courses.model.js');
const { courseTeacherRepository } = await import(
  '../../src/repositories/courseTeachers.repository.js'
);

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('Sequelize associations (institution models)', () => {
  it('Class.program resolves the parent program', async () => {
    const program = await createProgram({ name: 'Engineering' });
    const cls = await createClass({ programId: program.id });

    const found = await Class.findByPk(cls.id, { include: ['program'] });
    expect(found?.program?.name).toBe('Engineering');
  });

  it('Program.classes resolves child classes', async () => {
    const program = await createProgram();
    await createClass({ programId: program.id, name: 'Grade 10', orderIndex: 1 });
    await createClass({ programId: program.id, name: 'Grade 11', orderIndex: 2 });

    const found = await Program.findByPk(program.id, { include: ['classes'] });
    expect(found?.classes).toHaveLength(2);
  });

  it('Class.sections and Class.courses resolve their children', async () => {
    const cls = await createClass();
    const batch = await createBatch({ programId: cls.programId });
    await createSection({ classId: cls.id, batchId: batch.id, name: 'A' });
    await createCourse({
      classId: cls.id,
      title: 'Physics',
      code: `PHYS-${Date.now()}-${Math.random()}`,
    });

    const found = await Class.findByPk(cls.id, { include: ['sections', 'courses'] });
    expect(found?.sections).toHaveLength(1);
    expect(found?.courses).toHaveLength(1);
  });

  it('Section resolves its class, batch, and class teacher', async () => {
    const cls = await createClass();
    const batch = await createBatch({ programId: cls.programId });
    const teacher = await createTeacherUser();
    const section = await createSection({
      classId: cls.id,
      batchId: batch.id,
      classTeacherId: teacher.id,
    });

    const found = await Section.findByPk(section.id, {
      include: ['class', 'batch', 'classTeacher'],
    });
    expect(found?.class?.id).toBe(cls.id);
    expect(found?.batch?.id).toBe(batch.id);
    expect(found?.classTeacher?.id).toBe(teacher.id);
  });

  it('Course.teachers resolves assigned teachers through CourseTeacher', async () => {
    const course = await createCourse();
    const teacher = await createTeacherUser({ name: 'Ada Lovelace' });
    await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });

    const found = await Course.findByPk(course.id, { include: ['teachers'] });
    expect(found?.teachers).toHaveLength(1);
    expect(found?.teachers?.[0]?.name).toBe('Ada Lovelace');
  });
});
