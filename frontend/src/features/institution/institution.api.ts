import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  academicYearSchema,
  batchSchema,
  classSchema,
  courseSchema,
  courseTeacherSchema,
  institutionProfileSchema,
  programSchema,
  sectionSchema,
  type AcademicYear,
  type AssignCourseTeacherInput,
  type Batch,
  type Class,
  type Course,
  type CourseTeacher,
  type CreateAcademicYearInput,
  type CreateBatchInput,
  type CreateClassInput,
  type CreateCourseInput,
  type CreateProgramInput,
  type CreateSectionInput,
  type InstitutionProfile,
  type Program,
  type Section,
  type UpdateInstitutionProfileInput,
} from './institution.schema.js';

export const fetchPrograms = async (): Promise<Program[]> => {
  const res = await api.get('/admin/programs');
  return z.array(programSchema).parse(res.data.data);
};

export const createProgram = async (input: CreateProgramInput): Promise<Program> => {
  const res = await api.post('/admin/programs', input);
  return programSchema.parse(res.data.data);
};

export const updateProgram = async (
  id: string,
  input: CreateProgramInput,
): Promise<Program> => {
  const res = await api.patch(`/admin/programs/${id}`, input);
  return programSchema.parse(res.data.data);
};

export const deleteProgram = async (id: string): Promise<void> => {
  await api.delete(`/admin/programs/${id}`);
};

export const fetchClasses = async (): Promise<Class[]> => {
  const res = await api.get('/admin/classes');
  return z.array(classSchema).parse(res.data.data);
};

export const createClass = async (input: CreateClassInput): Promise<Class> => {
  const res = await api.post('/admin/classes', input);
  return classSchema.parse(res.data.data);
};

export const updateClass = async (id: string, input: CreateClassInput): Promise<Class> => {
  const res = await api.patch(`/admin/classes/${id}`, input);
  return classSchema.parse(res.data.data);
};

export const deleteClass = async (id: string): Promise<void> => {
  await api.delete(`/admin/classes/${id}`);
};

export const fetchBatches = async (programId?: string): Promise<Batch[]> => {
  const res = await api.get('/admin/batches', { params: programId ? { programId } : undefined });
  return z.array(batchSchema).parse(res.data.data);
};

export const createBatch = async (input: CreateBatchInput): Promise<Batch> => {
  const res = await api.post('/admin/batches', input);
  return batchSchema.parse(res.data.data);
};

export const updateBatch = async (id: string, input: { name: string }): Promise<Batch> => {
  const res = await api.patch(`/admin/batches/${id}`, input);
  return batchSchema.parse(res.data.data);
};

export const deleteBatch = async (id: string): Promise<void> => {
  await api.delete(`/admin/batches/${id}`);
};

export const fetchAcademicYears = async (): Promise<AcademicYear[]> => {
  const res = await api.get('/admin/academic-years');
  return z.array(academicYearSchema).parse(res.data.data);
};

export const createAcademicYear = async (
  input: CreateAcademicYearInput,
): Promise<AcademicYear> => {
  const res = await api.post('/admin/academic-years', input);
  return academicYearSchema.parse(res.data.data);
};

export const updateAcademicYear = async (
  id: string,
  input: CreateAcademicYearInput,
): Promise<AcademicYear> => {
  const res = await api.patch(`/admin/academic-years/${id}`, input);
  return academicYearSchema.parse(res.data.data);
};

export const deleteAcademicYear = async (id: string): Promise<void> => {
  await api.delete(`/admin/academic-years/${id}`);
};

export const fetchSections = async (): Promise<Section[]> => {
  const res = await api.get('/admin/sections');
  return z.array(sectionSchema).parse(res.data.data);
};

export const createSection = async (input: CreateSectionInput): Promise<Section> => {
  // An unselected optional Select yields '' — the backend's z.uuid().optional()
  // rejects an empty string, so omit the key entirely rather than send it.
  const { classTeacherId, ...rest } = input;
  const body = classTeacherId ? { ...rest, classTeacherId } : rest;
  const res = await api.post('/admin/sections', body);
  return sectionSchema.parse(res.data.data);
};

export const updateSection = async (
  id: string,
  input: CreateSectionInput,
): Promise<Section> => {
  // Unlike create, an edit can actively clear an assigned teacher — '' means
  // "no teacher", sent as an explicit null rather than an omitted key.
  const { classTeacherId, ...rest } = input;
  const res = await api.patch(`/admin/sections/${id}`, {
    ...rest,
    classTeacherId: classTeacherId ? classTeacherId : null,
  });
  return sectionSchema.parse(res.data.data);
};

export const deleteSection = async (id: string): Promise<void> => {
  await api.delete(`/admin/sections/${id}`);
};

export const fetchCourses = async (): Promise<Course[]> => {
  const res = await api.get('/admin/courses');
  return z.array(courseSchema).parse(res.data.data);
};

export const createCourse = async (input: CreateCourseInput): Promise<Course> => {
  const res = await api.post('/admin/courses', input);
  return courseSchema.parse(res.data.data);
};

export const updateCourse = async (id: string, input: CreateCourseInput): Promise<Course> => {
  const res = await api.patch(`/admin/courses/${id}`, input);
  return courseSchema.parse(res.data.data);
};

export const deleteCourse = async (id: string): Promise<void> => {
  await api.delete(`/admin/courses/${id}`);
};

export const fetchCourseTeachers = async (courseId: string): Promise<CourseTeacher[]> => {
  const res = await api.get(`/admin/courses/${courseId}/teachers`);
  return z.array(courseTeacherSchema).parse(res.data.data);
};

export const assignCourseTeacher = async (
  courseId: string,
  input: AssignCourseTeacherInput,
): Promise<CourseTeacher> => {
  const res = await api.post(`/admin/courses/${courseId}/teachers`, input);
  return courseTeacherSchema.parse(res.data.data);
};

/** Public — the whole app (including the dashboard shell) needs the
 * institution's name without an admin session. Returns null until an admin
 * has configured it. */
export const fetchInstitutionProfile = async (): Promise<InstitutionProfile | null> => {
  const res = await api.get('/institution-profile');
  return institutionProfileSchema.nullable().parse(res.data.data);
};

export const updateInstitutionProfile = async (
  input: UpdateInstitutionProfileInput,
): Promise<InstitutionProfile> => {
  const res = await api.patch('/institution-profile', input);
  return institutionProfileSchema.parse(res.data.data);
};
