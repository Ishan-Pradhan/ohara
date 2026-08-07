import { api } from '../../lib/axios.js';
import { studyPlanSchema, type StudyPlan } from './studyPlan.schema.js';

export const fetchStudyPlan = async (): Promise<StudyPlan | null> => {
  const res = await api.get('/dashboard/me/study-plan');
  if (res.data.data === null) return null;
  return studyPlanSchema.parse(res.data.data);
};

export const generateStudyPlan = async (): Promise<StudyPlan> => {
  const res = await api.post('/dashboard/me/study-plan');
  return studyPlanSchema.parse(res.data.data);
};

export const toggleTask = async (params: {
  dayIndex: number;
  taskIndex: number;
  done: boolean;
}): Promise<StudyPlan> => {
  const res = await api.patch('/dashboard/me/study-plan/tasks', params);
  return studyPlanSchema.parse(res.data.data);
};

export const deleteTask = async (params: {
  dayIndex: number;
  taskIndex: number;
}): Promise<StudyPlan> => {
  const res = await api.delete('/dashboard/me/study-plan/tasks', { data: params });
  return studyPlanSchema.parse(res.data.data);
};

export interface AddTaskPayload {
  dayIndex: number;
  task: {
    title: string;
    description: string;
    estimatedMinutes: number;
    priority: 'high' | 'medium' | 'low';
    courseTitle?: string;
  };
}

export const addTask = async (payload: AddTaskPayload): Promise<StudyPlan> => {
  const res = await api.post('/dashboard/me/study-plan/tasks', payload);
  return studyPlanSchema.parse(res.data.data);
};
