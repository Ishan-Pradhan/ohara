import { z } from 'zod';

export const attendanceStatusSchema = z.enum(['present', 'absent', 'late']);

export const attendanceRecordSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  status: attendanceStatusSchema,
});

export const attendanceSessionSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  sessionDate: z.string(),
  records: z.array(attendanceRecordSchema),
});

export const attendanceSessionSummarySchema = z.object({
  id: z.string(),
  courseId: z.string(),
  sessionDate: z.string(),
});

export const attendancePercentageSchema = z.object({
  total: z.number(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  percentage: z.number().nullable(),
});

export const attendanceSummaryRowSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
}).extend(attendancePercentageSchema.shape);

export const createAttendanceSessionSchema = z.object({
  sessionDate: z.string().min(1, 'Date is required'),
  records: z.array(z.object({ studentId: z.string(), status: attendanceStatusSchema })).min(1),
});

export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type AttendanceSession = z.infer<typeof attendanceSessionSchema>;
export type AttendanceSessionSummary = z.infer<typeof attendanceSessionSummarySchema>;
export type AttendancePercentage = z.infer<typeof attendancePercentageSchema>;
export type AttendanceSummaryRow = z.infer<typeof attendanceSummaryRowSchema>;
export type CreateAttendanceSessionInput = z.infer<typeof createAttendanceSessionSchema>;
