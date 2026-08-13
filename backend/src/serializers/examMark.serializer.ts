import type { ExamMark } from '../models/examMarks.model.js';

export interface CourseExamMarkRow {
  studentId: string;
  studentName: string;
  marksObtained: number | null;
  maxMarks: number | null;
}

/** The marks-entry/marks-view grid for one course + exam term: every
 * roster student, with their existing mark if one was already entered.
 * `existing` is keyed by studentId, one row per roster entry — same shape
 * as attendance's roster-join pattern. */
export const buildCourseExamMarkRows = (
  roster: { studentId: string; studentName: string }[],
  existing: ExamMark[],
): CourseExamMarkRow[] => {
  const byStudent = new Map(existing.map((m) => [m.studentId, m]));
  return roster.map((r) => {
    const mark = byStudent.get(r.studentId);
    return {
      studentId: r.studentId,
      studentName: r.studentName,
      marksObtained: mark ? Number(mark.marksObtained) : null,
      maxMarks: mark ? Number(mark.maxMarks) : null,
    };
  });
};

export interface ReportCardExamTermHeader {
  examTermId: string;
  examTermName: string;
}

export interface ReportCardCourseRow {
  courseId: string;
  courseTitle: string;
  marks: Record<string, { marksObtained: number; maxMarks: number }>;
  courseTotalObtained: number;
  courseTotalMax: number;
  coursePercentage: number | null;
}

export interface ReportCardSemesterSection {
  classId: string;
  className: string;
  orderIndex: number;
  batchName: string | null;
  sectionName: string | null;
  examTerms: ReportCardExamTermHeader[];
  courses: ReportCardCourseRow[];
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  grade: string;
}

const letterGrade = (percentage: number | null): string => {
  if (percentage === null) return 'N/A';
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
};

/** Groups a student's exam marks by Semester/Class, with a per-semester and
 * an overall cumulative percentage/grade. */
export const buildReportCard = (
  marks: ExamMark[],
  semesterMeta?: Map<string, { batchName: string | null; sectionName: string | null }>,
) => {
  const semestersMap = new Map<string, {
    classId: string;
    className: string;
    orderIndex: number;
    examTermsMap: Map<string, string>; // termId -> termName
    coursesMap: Map<string, {
      courseId: string;
      courseTitle: string;
      marks: Record<string, { marksObtained: number; maxMarks: number }>;
    }>;
  }>();

  for (const mark of marks) {
    const examTerm = mark.examTerm;
    const course = mark.course;
    if (!examTerm || !course || !course.class) continue;

    const classId = course.class.id;
    const className = course.class.name;

    let sem = semestersMap.get(classId);
    if (!sem) {
      sem = {
        classId,
        className,
        orderIndex: course.class.orderIndex,
        examTermsMap: new Map(),
        coursesMap: new Map(),
      };
      semestersMap.set(classId, sem);
    }

    sem.examTermsMap.set(examTerm.id, examTerm.name);

    let courseRow = sem.coursesMap.get(course.id);
    if (!courseRow) {
      courseRow = {
        courseId: course.id,
        courseTitle: course.title,
        marks: {},
      };
      sem.coursesMap.set(course.id, courseRow);
    }

    const marksObtained = Number(mark.marksObtained);
    const maxMarks = Number(mark.maxMarks);
    courseRow.marks[examTerm.id] = { marksObtained, maxMarks };
  }

  const semesters: ReportCardSemesterSection[] = [];
  let overallObtained = 0;
  let overallMax = 0;

  for (const sem of semestersMap.values()) {
    const examTerms: ReportCardExamTermHeader[] = [...sem.examTermsMap.entries()].map(([id, name]) => ({
      examTermId: id,
      examTermName: name,
    }));

    const courses: ReportCardCourseRow[] = [];
    let semObtained = 0;
    let semMax = 0;

    for (const courseRow of sem.coursesMap.values()) {
      let courseTotalObtained = 0;
      let courseTotalMax = 0;

      for (const termId of sem.examTermsMap.keys()) {
        const markVal = courseRow.marks[termId];
        if (markVal) {
          courseTotalObtained += markVal.marksObtained;
          courseTotalMax += markVal.maxMarks;
        }
      }

      courses.push({
        courseId: courseRow.courseId,
        courseTitle: courseRow.courseTitle,
        marks: courseRow.marks,
        courseTotalObtained,
        courseTotalMax,
        coursePercentage: courseTotalMax > 0 ? (courseTotalObtained / courseTotalMax) * 100 : null,
      });

      semObtained += courseTotalObtained;
      semMax += courseTotalMax;
    }

    const meta = semesterMeta?.get(sem.classId);
    semesters.push({
      classId: sem.classId,
      className: sem.className,
      orderIndex: sem.orderIndex,
      batchName: meta?.batchName ?? null,
      sectionName: meta?.sectionName ?? null,
      examTerms,
      courses,
      totalObtained: semObtained,
      totalMax: semMax,
      percentage: semMax > 0 ? (semObtained / semMax) * 100 : null,
      grade: letterGrade(semMax > 0 ? (semObtained / semMax) * 100 : null),
    });

    overallObtained += semObtained;
    overallMax += semMax;
  }

  // Sort semesters chronologically by class orderIndex
  semesters.sort((a, b) => a.orderIndex - b.orderIndex);

  const overallPercentage = overallMax > 0 ? (overallObtained / overallMax) * 100 : null;

  return {
    semesters,
    overallPercentage,
    overallGrade: letterGrade(overallPercentage),
  };
};
