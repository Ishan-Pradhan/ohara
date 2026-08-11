import type { Optional } from 'sequelize';

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceSessionAttributes {
  id: string;
  courseId: string;
  sectionId: string | null;
  sessionDate: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AttendanceSessionCreationAttributes = Optional<
  AttendanceSessionAttributes,
  'id' | 'sectionId' | 'createdAt' | 'updatedAt'
>;

export interface AttendanceRecordAttributes {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  reason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AttendanceRecordCreationAttributes = Optional<
  AttendanceRecordAttributes,
  'id' | 'reason' | 'createdAt' | 'updatedAt'
>;
