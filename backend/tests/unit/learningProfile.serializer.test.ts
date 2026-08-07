import { describe, expect, it } from 'vitest';

import { buildLearningProfileFallback } from '../../src/serializers/learningProfile.serializer.js';
import type { StudentPerformanceSnapshot } from '../../src/serializers/dashboard.serializer.js';

const snapshot = (overrides: Partial<StudentPerformanceSnapshot> = {}): StudentPerformanceSnapshot => ({
  status: 'ready',
  averageGrade: 88,
  attendancePercentage: 92,
  completionRate: 75,
  missingSubmissions: 1,
  lateSubmissions: 0,
  evidence: {
    courses: 1,
    assessments: 4,
    gradedAssessments: 3,
    completedAssessments: 3,
    attendanceRecords: 2,
  },
  courses: [
    {
      courseId: '22222222-2222-2222-2222-222222222222',
      courseTitle: 'Physics',
      status: 'ready',
      averageGrade: 88,
      attendancePercentage: 92,
      completionRate: 75,
      missingSubmissions: 1,
      lateSubmissions: 0,
      evidence: {
        assessments: 4,
        gradedAssessments: 3,
        completedAssessments: 3,
        attendanceRecords: 2,
      },
    },
  ],
  ...overrides,
});

describe('buildLearningProfileFallback', () => {
  it('summarizes strong evidence and flags the missing work', () => {
    const profile = buildLearningProfileFallback('Jane Doe', snapshot());

    expect(profile.summary).toContain('Jane Doe');
    expect(profile.strengths.some((item) => item.includes('Strong overall average'))).toBe(true);
    expect(profile.strengths.some((item) => item.includes('Attendance is strong'))).toBe(true);
    expect(profile.attentionAreas.some((item) => item.includes('missing'))).toBe(true);
    expect(profile.nextActions.length).toBeGreaterThan(0);
    expect(profile.courseInsights[0]).toMatchObject({
      courseTitle: 'Physics',
      status: 'developing',
    });
  });

  it('returns an insufficient-data profile when there is no evidence', () => {
    const profile = buildLearningProfileFallback(
      'Jane Doe',
      snapshot({
        status: 'insufficient_data',
        averageGrade: null,
        attendancePercentage: null,
        completionRate: null,
        missingSubmissions: 0,
        lateSubmissions: 0,
        evidence: {
          courses: 0,
          assessments: 0,
          gradedAssessments: 0,
          completedAssessments: 0,
          attendanceRecords: 0,
        },
        courses: [],
      }),
    );

    expect(profile.summary).toContain('not have enough');
    expect(profile.strengths).toEqual([]);
    expect(profile.attentionAreas).toEqual([]);
    expect(profile.nextActions.length).toBe(2);
  });
});
