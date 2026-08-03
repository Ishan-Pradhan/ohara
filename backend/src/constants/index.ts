// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  ALUMNI: 'alumni',
} as const;

// Academic / access status. Drives soft-delete and graduation.
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  GRADUATED: 'graduated',
  ARCHIVED: 'archived',
} as const;

export const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;
export const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export const INSTITUTION_TYPES = {
  SCHOOL: 'school',
  COLLEGE: 'college',
  UNIVERSITY: 'university',
} as const;