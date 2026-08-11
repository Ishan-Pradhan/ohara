import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignCourseTeacher,
  createAcademicYear,
  createBatch,
  createClass,
  createCourse,
  createProgram,
  createSection,
  deleteAcademicYear,
  deleteBatch,
  deleteClass,
  deleteCourse,
  deleteProgram,
  deleteSection,
  fetchAcademicYears,
  fetchBatches,
  fetchClasses,
  fetchCourseTeachers,
  fetchCourses,
  fetchInstitutionProfile,
  fetchPrograms,
  fetchSections,
  updateAcademicYear,
  updateBatch,
  updateClass,
  updateCourse,
  updateInstitutionProfile,
  updateProgram,
  updateSection,
} from './institution.api.js';
import type {
  AssignCourseTeacherInput,
  CreateAcademicYearInput,
  CreateBatchInput,
  CreateClassInput,
  CreateCourseInput,
  CreateProgramInput,
  CreateSectionInput,
  UpdateInstitutionProfileInput,
} from './institution.schema.js';

export const PROGRAMS_KEY = ['institution', 'programs'] as const;
export const CLASSES_KEY = ['institution', 'classes'] as const;
export const ACADEMIC_YEARS_KEY = ['institution', 'academic-years'] as const;
export const SECTIONS_KEY = ['institution', 'sections'] as const;
export const COURSES_KEY = ['institution', 'courses'] as const;

export const usePrograms = () =>
  useQuery({ queryKey: PROGRAMS_KEY, queryFn: fetchPrograms });

export const useCreateProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProgram,
    onSuccess: () => qc.invalidateQueries({ queryKey: PROGRAMS_KEY }),
  });
};

export const useUpdateProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateProgramInput }) =>
      updateProgram(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROGRAMS_KEY }),
  });
};

export const useDeleteProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProgram,
    onSuccess: () => qc.invalidateQueries({ queryKey: PROGRAMS_KEY }),
  });
};

export const useClasses = (params?: { programId?: string; batchId?: string }) =>
  useQuery({ queryKey: [...CLASSES_KEY, params], queryFn: () => fetchClasses(params) });

export const useCreateClass = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createClass,
    onSuccess: () => qc.invalidateQueries({ queryKey: CLASSES_KEY }),
  });
};

export const useUpdateClass = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateClassInput }) =>
      updateClass(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLASSES_KEY }),
  });
};

export const useDeleteClass = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteClass,
    onSuccess: () => qc.invalidateQueries({ queryKey: CLASSES_KEY }),
  });
};

export const batchesKey = (programId?: string) => ['institution', 'batches', programId] as const;

export const useBatches = (programId?: string) =>
  useQuery({
    queryKey: batchesKey(programId),
    queryFn: () => fetchBatches(programId),
  });

export const useCreateBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchInput) => createBatch(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institution', 'batches'] }),
  });
};

export const useUpdateBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name: string } }) => updateBatch(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institution', 'batches'] }),
  });
};

export const useDeleteBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBatch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institution', 'batches'] }),
  });
};

export const useAcademicYears = () =>
  useQuery({ queryKey: ACADEMIC_YEARS_KEY, queryFn: fetchAcademicYears });

export const useCreateAcademicYear = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAcademicYear,
    onSuccess: () => qc.invalidateQueries({ queryKey: ACADEMIC_YEARS_KEY }),
  });
};

export const useUpdateAcademicYear = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateAcademicYearInput }) =>
      updateAcademicYear(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACADEMIC_YEARS_KEY }),
  });
};

export const useDeleteAcademicYear = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAcademicYear,
    onSuccess: () => qc.invalidateQueries({ queryKey: ACADEMIC_YEARS_KEY }),
  });
};

export const useSections = () =>
  useQuery({ queryKey: SECTIONS_KEY, queryFn: fetchSections });

export const useCreateSection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSection,
    onSuccess: () => qc.invalidateQueries({ queryKey: SECTIONS_KEY }),
  });
};

export const useUpdateSection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateSectionInput }) =>
      updateSection(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: SECTIONS_KEY }),
  });
};

export const useDeleteSection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSection,
    onSuccess: () => qc.invalidateQueries({ queryKey: SECTIONS_KEY }),
  });
};

export const useCourses = (enabled = true) =>
  useQuery({ queryKey: COURSES_KEY, queryFn: fetchCourses, enabled });

export const useCreateCourse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: COURSES_KEY }),
  });
};

export const useUpdateCourse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateCourseInput }) =>
      updateCourse(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: COURSES_KEY }),
  });
};

export const useDeleteCourse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: COURSES_KEY }),
  });
};

export const courseTeachersKey = (courseId: string) =>
  ['institution', 'courses', courseId, 'teachers'] as const;

export const useCourseTeachers = (courseId: string) =>
  useQuery({
    queryKey: courseTeachersKey(courseId),
    queryFn: () => fetchCourseTeachers(courseId),
    enabled: Boolean(courseId),
  });

export const useAssignCourseTeacher = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignCourseTeacherInput) => assignCourseTeacher(courseId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: courseTeachersKey(courseId) }),
  });
};

export const INSTITUTION_PROFILE_KEY = ['institution', 'profile'] as const;

export const useInstitutionProfile = () =>
  useQuery({ queryKey: INSTITUTION_PROFILE_KEY, queryFn: fetchInstitutionProfile });

export const useUpdateInstitutionProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInstitutionProfileInput) => updateInstitutionProfile(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSTITUTION_PROFILE_KEY }),
  });
};
