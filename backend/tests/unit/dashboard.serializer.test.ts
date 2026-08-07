import { describe, expect, it } from 'vitest';

import {
  buildStudentPerformanceSnapshot,
  buildTutorLearningContext,
} from '../../src/serializers/dashboard.serializer.js';
import type { Gradebook } from '../../src/types/gradebook.types.js';

const studentId = '11111111-1111-1111-1111-111111111111';

const buildEmptyGradebook = (): Gradebook => ({
  assessments: [],
  rows: [
    {
      studentId,
      studentName: 'Jane Doe',
      entries: [],
      totalScore: 0,
      totalMaxScore: 0,
      average: null,
    },
  ],
});

describe('buildStudentPerformanceSnapshot', () => {
  it('returns insufficient_data when there is no academic evidence yet', () => {
    const snapshot = buildStudentPerformanceSnapshot(studentId, [
      {
        courseId: '22222222-2222-2222-2222-222222222222',
        courseTitle: 'Physics',
        gradebook: buildEmptyGradebook(),
        attendanceRecords: [],
        lateSubmissions: 0,
      },
    ]);

    expect(snapshot.status).toBe('insufficient_data');
    expect(snapshot.averageGrade).toBeNull();
    expect(snapshot.attendancePercentage).toBeNull();
    expect(snapshot.completionRate).toBeNull();
    expect(snapshot.evidence).toEqual({
      courses: 1,
      assessments: 0,
      gradedAssessments: 0,
      completedAssessments: 0,
      attendanceRecords: 0,
    });
    expect(snapshot.courses[0]).toMatchObject({
      courseId: '22222222-2222-2222-2222-222222222222',
      status: 'insufficient_data',
      averageGrade: null,
      attendancePercentage: null,
      completionRate: null,
      missingSubmissions: 0,
      lateSubmissions: 0,
    });
  });
});

describe('buildTutorLearningContext', () => {
  it('returns null when the snapshot is insufficient_data', () => {
    const snapshot = buildStudentPerformanceSnapshot(studentId, []);
    expect(snapshot.status).toBe('insufficient_data');
    expect(buildTutorLearningContext(snapshot)).toBeNull();
  });

  it('returns a text block with overall metrics when the snapshot is ready', () => {
    const gradebook: Gradebook = {
      assessments: [{ id: 'a1', title: 'Essay', type: 'assignment', maxScore: 10 }],
      rows: [
        {
          studentId,
          studentName: 'Jane Doe',
          entries: [
            {
              assessmentId: 'a1',
              type: 'assignment' as const,
              score: 8,
              maxScore: 10,
              status: 'graded' as const,
            },
          ],
          totalScore: 8,
          totalMaxScore: 10,
          average: 80,
        },
      ],
    };
    const snapshot = buildStudentPerformanceSnapshot(studentId, [
      {
        courseId: '22222222-2222-2222-2222-222222222222',
        courseTitle: 'Physics',
        gradebook,
        attendanceRecords: [{ status: 'present' }, { status: 'absent' }],
        lateSubmissions: 1,
      },
    ]);
    expect(snapshot.status).toBe('ready');
    const ctx = buildTutorLearningContext(snapshot);
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('Overall average grade:');
    expect(ctx).toContain('Attendance:');
    expect(ctx).toContain('Physics:');
    expect(ctx).toContain('Student learning context');
  });

  it('returns null when all courses are insufficient_data (no metrics to include)', () => {
    const snapshot = buildStudentPerformanceSnapshot(studentId, [
      {
        courseId: '22222222-2222-2222-2222-222222222222',
        courseTitle: 'Physics',
        gradebook: buildEmptyGradebook(),
        attendanceRecords: [],
        lateSubmissions: 0,
      },
    ]);
    // status is insufficient_data → should return null
    expect(buildTutorLearningContext(snapshot)).toBeNull();
  });
});
