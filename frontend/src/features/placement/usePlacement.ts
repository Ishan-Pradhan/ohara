import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bulkPromoteSection,
  createClassMembership,
  createEnrollment,
  fetchClassMemberships,
  fetchSectionRoster,
  fetchStudentPlacement,
  setClassMembershipOutcome,
  transferClassMembership,
} from './placement.api.js';
import type { BulkPromoteInput, OutcomeInput, TransferInput } from './placement.schema.js';

export const studentPlacementKey = (studentId: string) =>
  ['placement', 'student', studentId] as const;

export const classMembershipsKey = (studentId: string) =>
  ['placement', 'class-memberships', studentId] as const;

/** 404s when the student isn't placed for the current year — callers should
 * treat `isError` as "not placed yet", not a failure to surface generically. */
export const useStudentPlacement = (studentId: string) =>
  useQuery({
    queryKey: studentPlacementKey(studentId),
    queryFn: () => fetchStudentPlacement(studentId),
    enabled: Boolean(studentId),
    retry: false,
  });

export const useClassMemberships = (studentId: string) =>
  useQuery({
    queryKey: classMembershipsKey(studentId),
    queryFn: () => fetchClassMemberships(studentId),
    enabled: Boolean(studentId),
  });

const invalidateStudent = (qc: ReturnType<typeof useQueryClient>, studentId: string) => {
  void qc.invalidateQueries({ queryKey: studentPlacementKey(studentId) });
  void qc.invalidateQueries({ queryKey: classMembershipsKey(studentId) });
};

export const useCreateClassMembership = (studentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sectionId: string; batchId: string }) =>
      createClassMembership({ studentId, ...input }),
    onSuccess: () => invalidateStudent(qc, studentId),
  });
};

export const useCreateEnrollment = (studentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => createEnrollment({ studentId, courseId }),
    onSuccess: () => invalidateStudent(qc, studentId),
  });
};

export const useTransferClassMembership = (studentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, input }: { membershipId: string; input: TransferInput }) =>
      transferClassMembership(membershipId, input),
    onSuccess: () => invalidateStudent(qc, studentId),
  });
};

export const useSetClassMembershipOutcome = (studentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, input }: { membershipId: string; input: OutcomeInput }) =>
      setClassMembershipOutcome(membershipId, input),
    onSuccess: () => invalidateStudent(qc, studentId),
  });
};

export const sectionRosterKey = (sectionId: string) => ['placement', 'roster', sectionId] as const;

export const useSectionRoster = (sectionId: string) =>
  useQuery({
    queryKey: sectionRosterKey(sectionId),
    queryFn: () => fetchSectionRoster(sectionId),
    enabled: Boolean(sectionId),
  });

export const useBulkPromoteSection = (sectionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkPromoteInput) => bulkPromoteSection(sectionId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: sectionRosterKey(sectionId) }),
  });
};
