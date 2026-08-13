/**
 * Second-pass demo seeder: transcripts (exam marks), attendance, assignments
 * + submissions + grades, and quizzes + attempts + grades — for the 220
 * students created by seedDemoData.ts. Same rules as that script: goes
 * through the real repositories, never raw inserts for anything the app
 * itself validates, and is scoped ONLY to seeded demo students (email LIKE
 * 'student.%@ohara.edu') — the pre-existing real test accounts (Ishan
 * Student, luffy badar, etc.) are never touched.
 *
 * Split by class_membership outcome, which already encodes exactly what we
 * need:
 *   - outcome IN ('promoted','graduated') = a COMPLETED semester -> gets a
 *     transcript entry (ExamMark). No attendance/assignments/quizzes for
 *     these — that's this-semester activity, not history.
 *   - outcome = 'enrolled' = the student's CURRENT, in-progress semester ->
 *     gets attendance sessions, an assignment, and a quiz. No exam marks
 *     yet — they haven't sat that semester's final.
 *
 * Run with: npx tsx src/scripts/seedActivityData.ts
 */
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import { User } from '../models/users.model.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { Section } from '../models/sections.model.js';
import { Course } from '../models/courses.model.js';
import { AcademicYear } from '../models/academicYears.model.js';
import { ExamTerm } from '../models/examTerms.model.js';
import { ExamMark } from '../models/examMarks.model.js';
import { Assignment } from '../models/assignments.model.js';
import { Quiz } from '../models/quizzes.model.js';
import { CourseTeacher } from '../models/courseTeachers.model.js';

import { examTermRepository } from '../repositories/examTerms.repository.js';
import { examMarkRepository } from '../repositories/examMarks.repository.js';
import { attendanceSessionRepository } from '../repositories/attendanceSessions.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { gradeRepository } from '../repositories/grades.repository.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { questionRepository } from '../repositories/questions.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { quizAnswerGradeRepository } from '../repositories/quizAnswerGrades.repository.js';

import { GRADE_STATUS, QUIZ_STATUS, QUESTION_TYPES } from '../constants/index.js';
import type { RubricCriterion } from '../types/assignments.types.js';
import type { CriterionFeedback } from '../types/grades.types.js';
import type { QuizResponse } from '../types/quizAttempts.types.js';

const DEMO_EMAIL_PATTERN = 'student.%@ohara.edu';

// A stable per-student "ability" factor (0.55-0.95) so the same student is
// consistently a stronger or weaker performer across attendance/grades/exam
// marks, instead of every number being independently random noise.
const abilityCache = new Map<string, number>();
const abilityOf = (studentId: string): number => {
  let a = abilityCache.get(studentId);
  if (a === undefined) {
    a = 0.55 + Math.random() * 0.4;
    abilityCache.set(studentId, a);
  }
  return a;
};

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

// ── Weekday date helpers for "current activity" (dated near today, not the
// nominal 2027-odd academic-year range — see script header) ────────────────

const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6;

const weekdaysBetween = (start: Date, end: Date): Date[] => {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (!isWeekend(cur)) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

const ACTIVITY_WINDOW_START = new Date('2026-05-18'); // ~3 months of "this semester so far"
const ACTIVITY_WINDOW_END = new Date('2026-08-10'); // just before "today" (2026-08-12)

// ── Transcripts: ExamTerm per academic year + ExamMark per completed course ─

const ensureExamTerms = async (adminId: string): Promise<Map<string, string>> => {
  const years = await AcademicYear.findAll({
    where: { name: { [Op.in]: ['2023 odd', '2023 even', '2024 odd', '2024 even', '2025 odd', '2025 even', '2026 odd', '2026 even'] } },
  });
  const termIdByYearId = new Map<string, string>();
  for (const year of years) {
    const name = `${year.name} Final Examination`;
    let term = await ExamTerm.findOne({ where: { academicYearId: year.id } });
    if (!term) {
      term = await examTermRepository.create({ name, academicYearId: year.id, createdBy: adminId });
    }
    termIdByYearId.set(year.id, term.id);
  }
  return termIdByYearId;
};

const seedTranscripts = async (adminId: string) => {
  console.log('\n--- Transcripts (ExamTerm + ExamMark) ---');
  const termIdByYearId = await ensureExamTerms(adminId);

  const completed = await ClassMembership.findAll({
    where: { outcome: { [Op.in]: ['promoted', 'graduated'] } },
    include: [
      { model: User, as: 'student', where: { email: { [Op.like]: DEMO_EMAIL_PATTERN } }, attributes: ['id'] },
      { model: Section, as: 'section', attributes: ['classId'] },
    ],
  });
  console.log(`Completed semester placements to grade: ${completed.length}`);

  // Cache courses per classId (a handful of distinct classes, looked up once each).
  const coursesByClassId = new Map<string, Course[]>();
  const getCourses = async (classId: string): Promise<Course[]> => {
    let list = coursesByClassId.get(classId);
    if (!list) {
      list = await Course.findAll({ where: { classId } });
      coursesByClassId.set(classId, list);
    }
    return list;
  };

  let created = 0;
  let skipped = 0;
  for (const membership of completed) {
    const examTermId = termIdByYearId.get(membership.academicYearId);
    if (!examTermId) continue;
    const classId = (membership.section as unknown as { classId: string }).classId;
    const courses = await getCourses(classId);
    if (courses.length === 0) continue;

    const existingCount = await ExamMark.count({
      where: { examTermId, studentId: membership.studentId, courseId: { [Op.in]: courses.map((c) => c.id) } },
    });
    if (existingCount >= courses.length) {
      skipped += courses.length;
      continue;
    }

    const ability = abilityOf(membership.studentId);
    const rows = courses.map((course) => {
      const marksObtained = Math.round(Math.min(100, Math.max(35, ability * 100 + randomBetween(-12, 8))));
      return {
        examTermId,
        courseId: course.id,
        studentId: membership.studentId,
        marksObtained,
        maxMarks: 100,
        enteredBy: adminId,
      };
    });
    await examMarkRepository.bulkCreate(rows);
    created += rows.length;
  }
  console.log(`ExamMark rows created: ${created} (skipped ${skipped} already present)`);
};

// ── Current-activity: attendance, assignment, quiz for each active (course,section) group ─

interface ActiveGroup {
  courseId: string;
  courseTitle: string;
  sectionId: string;
  teacherId: string | null;
  studentIds: string[];
}

const loadActiveGroups = async (): Promise<ActiveGroup[]> => {
  const enrolled = await ClassMembership.findAll({
    where: { outcome: 'enrolled' },
    include: [
      { model: User, as: 'student', where: { email: { [Op.like]: DEMO_EMAIL_PATTERN } }, attributes: ['id'] },
      { model: Section, as: 'section', attributes: ['id', 'classId'] },
    ],
  });

  const studentIdsBySectionId = new Map<string, { sectionId: string; classId: string; studentIds: string[] }>();
  for (const m of enrolled) {
    const section = m.section as unknown as { id: string; classId: string };
    const bucket = studentIdsBySectionId.get(section.id) ?? { sectionId: section.id, classId: section.classId, studentIds: [] };
    bucket.studentIds.push(m.studentId);
    studentIdsBySectionId.set(section.id, bucket);
  }

  const groups: ActiveGroup[] = [];
  for (const { sectionId, classId, studentIds } of studentIdsBySectionId.values()) {
    const courses = await Course.findAll({ where: { classId } });
    for (const course of courses) {
      const ct = await CourseTeacher.findOne({ where: { courseId: course.id } });
      groups.push({ courseId: course.id, courseTitle: course.title, sectionId, teacherId: ct?.teacherId ?? null, studentIds });
    }
  }
  return groups;
};

// ── Attendance ──────────────────────────────────────────────────────────

const seedAttendance = async (groups: ActiveGroup[], adminId: string) => {
  console.log('\n--- Attendance ---');
  const sessionDates = weekdaysBetween(ACTIVITY_WINDOW_START, ACTIVITY_WINDOW_END).filter((_, i) => i % 3 === 0); // ~1 session/week
  let sessionsCreated = 0;
  let recordsCreated = 0;

  for (const group of groups) {
    const existing = await sequelize.query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM "AttendanceSessions" WHERE "courseId" = :courseId AND "sectionId" = :sectionId`,
      { replacements: { courseId: group.courseId, sectionId: group.sectionId }, type: QueryTypes.SELECT },
    );
    if (Number(existing[0]?.cnt ?? 0) > 0) continue; // already seeded this group

    for (const date of sessionDates) {
      const session = await attendanceSessionRepository.create({
        courseId: group.courseId,
        sectionId: group.sectionId,
        sessionDate: date.toISOString().slice(0, 10),
        createdBy: group.teacherId ?? adminId,
      });
      sessionsCreated++;

      const records = group.studentIds.map((studentId) => {
        const ability = abilityOf(studentId);
        const roll = Math.random();
        const status = roll < ability ? 'present' : roll < ability + 0.08 ? 'late' : 'absent';
        return { sessionId: session.id, studentId, status: status as 'present' | 'late' | 'absent' };
      });
      await attendanceRecordRepository.bulkCreate(records);
      recordsCreated += records.length;
    }
  }
  console.log(`Attendance sessions: ${sessionsCreated}, records: ${recordsCreated}`);
};

// ── Assignments + submissions + grades ─────────────────────────────────

const RUBRIC: RubricCriterion[] = [
  { criterion: 'Understanding of concepts', maxPoints: 40, description: 'Demonstrates correct grasp of the core material' },
  { criterion: 'Clarity and structure', maxPoints: 30, description: 'Well organized, clearly written' },
  { criterion: 'Examples and application', maxPoints: 30, description: 'Uses relevant examples to support points' },
];

const seedAssignments = async (groups: ActiveGroup[], academicYearId: string, adminId: string) => {
  console.log('\n--- Assignments + Submissions + Grades ---');
  let assignmentsCreated = 0;
  let submissionsCreated = 0;
  let gradesCreated = 0;

  for (const group of groups) {
    const existing = await Assignment.findOne({ where: { courseId: group.courseId } });
    if (existing) continue; // already seeded this course

    const dueAt = new Date(ACTIVITY_WINDOW_END);
    dueAt.setDate(dueAt.getDate() - 7);
    const assignment = await assignmentRepository.create({
      courseId: group.courseId,
      academicYearId,
      title: `Assignment 1: ${group.courseTitle} Report`,
      prompt: `Write a short report covering the key concepts of ${group.courseTitle} discussed so far this semester, with at least one worked example.`,
      rubric: RUBRIC,
      dueAt,
    });
    assignmentsCreated++;

    for (const studentId of group.studentIds) {
      const ability = abilityOf(studentId);
      const isLate = Math.random() < 0.12;
      const submittedAt = new Date(dueAt);
      submittedAt.setDate(submittedAt.getDate() + (isLate ? Math.ceil(randomBetween(1, 3)) : -Math.ceil(randomBetween(0, 4))));

      const submission = await submissionRepository.create({
        assignmentId: assignment.id,
        studentId,
        content: `(Seeded demo submission for "${assignment.title}".)`,
        isLate,
        submittedAt,
      });
      submissionsCreated++;

      const criterionFeedback: CriterionFeedback[] = RUBRIC.map((c) => {
        const awardedPoints = Math.round(Math.min(c.maxPoints, Math.max(0, c.maxPoints * (ability + randomBetween(-0.15, 0.1)))));
        return { criterion: c.criterion, maxPoints: c.maxPoints, awardedPoints, feedback: 'Good work overall — see rubric for detail.' };
      });
      const score = criterionFeedback.reduce((sum, c) => sum + c.awardedPoints, 0);
      const approved = Math.random() < 0.7;

      await gradeRepository.create({
        submissionId: submission.id,
        score,
        criterionFeedback,
        overallFeedback: 'Solid submission — keep developing your examples.',
        status: approved ? GRADE_STATUS.APPROVED : GRADE_STATUS.DRAFT,
        approvedBy: approved ? (group.teacherId ?? adminId) : null,
      });
      gradesCreated++;
    }
  }
  console.log(`Assignments: ${assignmentsCreated}, submissions: ${submissionsCreated}, grades: ${gradesCreated}`);
};

// ── Quizzes + attempts + (short-answer) grades ─────────────────────────

const seedQuizzes = async (groups: ActiveGroup[], academicYearId: string, adminId: string) => {
  console.log('\n--- Quizzes + Attempts + Grades ---');
  let quizzesCreated = 0;
  let attemptsCreated = 0;
  let answerGradesCreated = 0;

  for (const group of groups) {
    const existing = await Quiz.findOne({ where: { courseId: group.courseId } });
    if (existing) continue;

    const quiz = await quizRepository.create({
      courseId: group.courseId,
      academicYearId,
      title: `${group.courseTitle} Quiz 1`,
      status: QUIZ_STATUS.PUBLISHED,
    });
    quizzesCreated++;

    const mcqOptions = [
      'It is a foundational concept covered in this course',
      'It is unrelated to the course syllabus',
      'It only applies to advanced electives',
      'It was deprecated in modern practice',
    ];
    const correctIndex = 0; // first option is always the "right" one for scoring purposes

    const questions = [
      ...Array.from({ length: 3 }, (_, i) => ({
        type: QUESTION_TYPES.MCQ,
        prompt: `Regarding a core topic in ${group.courseTitle}, which statement is correct? (Q${i + 1})`,
        options: mcqOptions,
        answer: { correctIndex },
        points: 2,
        orderIndex: i,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        type: QUESTION_TYPES.SHORT_ANSWER,
        prompt: `Briefly explain a key concept from ${group.courseTitle} in your own words. (Q${i + 4})`,
        options: null,
        answer: null,
        points: 3,
        orderIndex: i + 3,
      })),
    ];

    const createdQuestions = [];
    for (const q of questions) {
      createdQuestions.push(await questionRepository.create({ quizId: quiz.id, ...q }));
    }
    const maxScore = createdQuestions.reduce((sum, q) => sum + q.points, 0);
    const mcqQuestions = createdQuestions.filter((q) => q.type === QUESTION_TYPES.MCQ);
    const shortAnswerQuestions = createdQuestions.filter((q) => q.type === QUESTION_TYPES.SHORT_ANSWER);

    for (const studentId of group.studentIds) {
      const ability = abilityOf(studentId);
      const responses: QuizResponse[] = [];
      let mcqScore = 0;
      for (const q of mcqQuestions) {
        const correct = Math.random() < ability;
        const chosen = correct ? (q.answer as { correctIndex: number }).correctIndex : (((q.answer as { correctIndex: number }).correctIndex + 1) % mcqOptions.length);
        responses.push({ questionId: q.id, answer: chosen });
        if (correct) mcqScore += q.points;
      }
      for (const q of shortAnswerQuestions) {
        responses.push({ questionId: q.id, answer: `(Seeded demo answer touching on the core idea of ${group.courseTitle}.)` });
      }

      // Short-answer awarded points, pre-computed so the attempt's stored
      // score matches what the gradebook will later read from
      // QuizAnswerGrade rows — same relationship loadGradebook relies on.
      const shortAnswerAwards = shortAnswerQuestions.map((q) => Math.round(Math.min(q.points, Math.max(0, q.points * (ability + randomBetween(-0.2, 0.15))))));
      const shortAnswerScore = shortAnswerAwards.reduce((a, b) => a + b, 0);

      const attempt = await quizAttemptRepository.create({
        quizId: quiz.id,
        studentId,
        responses,
        score: mcqScore + shortAnswerScore,
        maxScore,
        submittedAt: pick(weekdaysBetween(ACTIVITY_WINDOW_START, ACTIVITY_WINDOW_END)),
      });
      attemptsCreated++;

      for (let i = 0; i < shortAnswerQuestions.length; i++) {
        const q = shortAnswerQuestions[i]!;
        const approved = Math.random() < 0.6;
        await quizAnswerGradeRepository.create({
          attemptId: attempt.id,
          questionId: q.id,
          awardedPoints: shortAnswerAwards[i]!,
          maxPoints: q.points,
          feedback: 'Reasonable explanation.',
          status: approved ? GRADE_STATUS.APPROVED : GRADE_STATUS.DRAFT,
          approvedBy: approved ? (group.teacherId ?? adminId) : null,
        });
        answerGradesCreated++;
      }
    }
  }
  console.log(`Quizzes: ${quizzesCreated}, attempts: ${attemptsCreated}, short-answer grades: ${answerGradesCreated}`);
};

// ── Main ─────────────────────────────────────────────────────────────────

const run = async () => {
  await sequelize.authenticate();
  console.log('Connected. Seeding attendance / grades / transcripts...\n');

  const admin = await User.findOne({ where: { role: 'admin' } });
  if (!admin) throw new Error('No admin user found — run the base seeder first.');

  await seedTranscripts(admin.id);

  const groups = await loadActiveGroups();
  console.log(`\nActive (course, section) groups this semester: ${groups.length}`);
  const currentYear = await AcademicYear.findOne({ where: { name: '2027 odd' } });
  if (!currentYear) throw new Error('"2027 odd" academic year not found — run seedDemoData.ts first.');

  await seedAttendance(groups, admin.id);
  await seedAssignments(groups, currentYear.id, admin.id);
  await seedQuizzes(groups, currentYear.id, admin.id);

  console.log('\nDone.');
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
