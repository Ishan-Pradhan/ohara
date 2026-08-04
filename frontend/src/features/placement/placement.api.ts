import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  classMembershipSchema,
  enrollmentSchema,
  studentPlacementSchema,
  type ClassMembership,
  type CreateClassMembershipInput,
  type CreateEnrollmentInput,
  type Enrollment,
  type OutcomeInput,
  type StudentPlacement,
  type TransferInput,
} from './placement.schema.js';

export const createClassMembership = async (
  input: CreateClassMembershipInput,
): Promise<ClassMembership> => {
  const res = await api.post('/admin/class-memberships', input);
  return classMembershipSchema.parse(res.data.data);
};

export const fetchClassMemberships = async (studentId: string): Promise<ClassMembership[]> => {
  const res = await api.get('/admin/class-memberships', { params: { studentId } });
  return z.array(classMembershipSchema).parse(res.data.data);
};

export const createEnrollment = async (input: CreateEnrollmentInput): Promise<Enrollment> => {
  const res = await api.post('/admin/enrollments', input);
  return enrollmentSchema.parse(res.data.data);
};

export const transferClassMembership = async (
  membershipId: string,
  input: TransferInput,
): Promise<ClassMembership> => {
  const res = await api.post(`/admin/class-memberships/${membershipId}/transfer`, input);
  return classMembershipSchema.parse(res.data.data);
};

export const setClassMembershipOutcome = async (
  membershipId: string,
  input: OutcomeInput,
): Promise<ClassMembership> => {
  const res = await api.post(`/admin/class-memberships/${membershipId}/outcome`, input);
  return classMembershipSchema.parse(res.data.data);
};

export const fetchStudentPlacement = async (studentId: string): Promise<StudentPlacement> => {
  const res = await api.get(`/students/${studentId}/placement`);
  return studentPlacementSchema.parse(res.data.data);
};
