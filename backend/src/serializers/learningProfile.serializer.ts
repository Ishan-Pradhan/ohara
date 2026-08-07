import type {
  StudentPerformanceCourseSnapshot,
  StudentPerformanceSnapshot,
} from './dashboard.serializer.js';

export type LearningProfileCourseStatus = 'strong' | 'developing' | 'needs_attention' | 'insufficient_data';

export interface LearningProfileCourseInsight {
  courseId: string;
  courseTitle: string;
  status: LearningProfileCourseStatus;
  note: string;
}

export interface LearningProfileInterpretation {
  summary: string;
  strengths: string[];
  attentionAreas: string[];
  nextActions: string[];
  courseInsights: LearningProfileCourseInsight[];
}

export interface LearningProfileDTO {
  snapshot: StudentPerformanceSnapshot;
  profile: LearningProfileInterpretation;
}

const STRONG_AVERAGE = 80;
const STRONG_ATTENDANCE = 85;
const DEVELOPING_AVERAGE = 60;
const DEVELOPING_ATTENDANCE = 70;

const courseStatusFromSnapshot = (course: StudentPerformanceCourseSnapshot): LearningProfileCourseStatus => {
  if (course.status === 'insufficient_data') {
    return 'insufficient_data';
  }

  if (
    (course.averageGrade !== null && course.averageGrade >= STRONG_AVERAGE) &&
    (course.attendancePercentage !== null && course.attendancePercentage >= STRONG_ATTENDANCE) &&
    course.missingSubmissions === 0
  ) {
    return 'strong';
  }

  if (
    (course.averageGrade !== null && course.averageGrade >= DEVELOPING_AVERAGE) ||
    (course.attendancePercentage !== null && course.attendancePercentage >= DEVELOPING_ATTENDANCE)
  ) {
    return 'developing';
  }

  return 'needs_attention';
};

const hasStrongEvidence = (snapshot: StudentPerformanceSnapshot): boolean =>
  snapshot.evidence.assessments > 0 || snapshot.evidence.attendanceRecords > 0;

export const buildLearningProfileFallback = (
  studentName: string,
  snapshot: StudentPerformanceSnapshot,
): LearningProfileInterpretation => {
  if (!hasStrongEvidence(snapshot)) {
    return {
      summary: `${studentName} does not have enough graded or attendance evidence yet to build a meaningful learning profile.`,
      strengths: [],
      attentionAreas: [],
      nextActions: [
        'Complete a few assignments or quizzes so performance can be measured.',
        'Attend the next class session so attendance can be factored in.',
      ],
      courseInsights: snapshot.courses.map((course) => ({
        courseId: course.courseId,
        courseTitle: course.courseTitle,
        status: 'insufficient_data',
        note: 'There is not enough evidence in this course yet to draw a conclusion.',
      })),
    };
  }

  const strengths: string[] = [];
  const attentionAreas: string[] = [];
  const nextActions: string[] = [];

  if (snapshot.averageGrade !== null && snapshot.averageGrade >= STRONG_AVERAGE) {
    strengths.push(`Strong overall average at ${snapshot.averageGrade.toFixed(1)}%.`);
  }
  if (snapshot.attendancePercentage !== null && snapshot.attendancePercentage >= STRONG_ATTENDANCE) {
    strengths.push(`Attendance is strong at ${snapshot.attendancePercentage.toFixed(1)}%.`);
  }
  if (snapshot.completionRate !== null && snapshot.completionRate >= 80) {
    strengths.push(`Course completion is on track at ${snapshot.completionRate.toFixed(1)}%.`);
  }
  if (snapshot.missingSubmissions === 0 && snapshot.lateSubmissions === 0) {
    strengths.push('There are no missing or late submissions in the current evidence set.');
  }

  if (snapshot.averageGrade !== null && snapshot.averageGrade < STRONG_AVERAGE) {
    attentionAreas.push(`Overall average is ${snapshot.averageGrade.toFixed(1)}%, which leaves room for improvement.`);
  }
  if (snapshot.attendancePercentage !== null && snapshot.attendancePercentage < DEVELOPING_ATTENDANCE) {
    attentionAreas.push(`Attendance is ${snapshot.attendancePercentage.toFixed(1)}%, so consistency needs attention.`);
  }
  if (snapshot.missingSubmissions > 0) {
    attentionAreas.push(`${snapshot.missingSubmissions} assessment(s) still appear missing from the current evidence.`);
  }
  if (snapshot.lateSubmissions > 0) {
    attentionAreas.push(`${snapshot.lateSubmissions} submission(s) were late.`);
  }

  if (snapshot.missingSubmissions > 0) {
    nextActions.push('Finish the missing assessments first.');
  }
  if (snapshot.lateSubmissions > 0) {
    nextActions.push('Plan earlier submission time for the next assignments.');
  }
  if (snapshot.attendancePercentage !== null && snapshot.attendancePercentage < DEVELOPING_ATTENDANCE) {
    nextActions.push('Prioritize attending the next few classes consistently.');
  }
  if (snapshot.averageGrade !== null && snapshot.averageGrade < STRONG_AVERAGE) {
    nextActions.push('Review the weaker topics from the latest assessments before the next one.');
  }

  if (nextActions.length === 0) {
    nextActions.push('Keep the current routine and monitor upcoming work.');
  }

  return {
    summary:
      strengths.length > 0
        ? `The current evidence suggests ${studentName} has some solid habits, but there are still areas that need deliberate attention.`
        : `${studentName}'s current evidence points to a mixed academic picture that should be monitored closely.`,
    strengths,
    attentionAreas,
    nextActions,
    courseInsights: snapshot.courses.map((course) => {
      const status = courseStatusFromSnapshot(course);
      const noteParts: string[] = [];
      if (course.averageGrade !== null) {
        noteParts.push(`average ${course.averageGrade.toFixed(1)}%`);
      }
      if (course.attendancePercentage !== null) {
        noteParts.push(`attendance ${course.attendancePercentage.toFixed(1)}%`);
      }
      if (course.missingSubmissions > 0) {
        noteParts.push(`${course.missingSubmissions} missing`);
      }
      if (course.lateSubmissions > 0) {
        noteParts.push(`${course.lateSubmissions} late`);
      }

      return {
        courseId: course.courseId,
        courseTitle: course.courseTitle,
        status,
        note:
          status === 'insufficient_data'
            ? 'Not enough evidence yet to interpret this course.'
            : noteParts.length > 0
              ? noteParts.join(' · ')
              : 'Evidence is present, but no clear pattern stands out yet.',
      };
    }),
  };
};

export const serializeLearningProfile = (
  snapshot: StudentPerformanceSnapshot,
  profile: LearningProfileInterpretation,
): LearningProfileDTO => ({
  snapshot,
  profile,
});
