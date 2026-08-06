import type { Optional } from 'sequelize';

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceSessionAttributes {
  id: string;
  courseId: string;
  sessionDate: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AttendanceSessionCreationAttributes = Optional<
  AttendanceSessionAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface AttendanceRecordAttributes {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AttendanceRecordCreationAttributes = Optional<
  AttendanceRecordAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;
