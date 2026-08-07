import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: "Not authorized to view this student's transcript" };
const notPlaced = { description: 'Student not found, or not currently placed' };

export const getTranscriptSchema = {
  params: z.object({ studentId: z.uuid() }),
};

export const getTranscriptPdfSchema = {
  params: z.object({ studentId: z.uuid() }),
};

const transcriptCourseRowSchema = z.object({
  courseId: z.uuid(),
  courseTitle: z.string(),
  marks: z.record(z.uuid(), z.object({
    marksObtained: z.number(),
    maxMarks: z.number(),
  })),
  courseTotalObtained: z.number(),
  courseTotalMax: z.number(),
  coursePercentage: z.number().nullable(),
});

const transcriptSemesterSectionSchema = z.object({
  classId: z.uuid(),
  className: z.string(),
  orderIndex: z.number(),
  examTerms: z.array(z.object({
    examTermId: z.uuid(),
    examTermName: z.string(),
  })),
  courses: z.array(transcriptCourseRowSchema),
  totalObtained: z.number(),
  totalMax: z.number(),
  percentage: z.number().nullable(),
  grade: z.string(),
});

const transcriptSchema = registry.register(
  'Transcript',
  z.object({
    studentId: z.uuid(),
    studentName: z.string(),
    programName: z.string(),
    className: z.string(),
    sectionName: z.string(),
    academicYearName: z.string(),
    semesters: z.array(transcriptSemesterSectionSchema),
    overallPercentage: z.number().nullable(),
    overallGrade: z.string(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/students/{studentId}/transcript',
  tags: ['Transcripts'],
  request: { params: getTranscriptSchema.params },
  responses: {
    200: {
      description: "Academic Transcript: student's exam marks grouped by semester in a matrix table, across every course, with computed totals/percentage/grade.",
      content: { 'application/json': { schema: envelope(transcriptSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: notPlaced,
  },
});

registry.registerPath({
  method: 'get',
  path: '/students/{studentId}/transcript/pdf',
  tags: ['Transcripts'],
  request: { params: getTranscriptPdfSchema.params },
  responses: {
    200: {
      description: 'The same academic transcript as a downloadable PDF export',
      content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
    },
    401: unauthenticated,
    403: forbidden,
    404: notPlaced,
  },
});
