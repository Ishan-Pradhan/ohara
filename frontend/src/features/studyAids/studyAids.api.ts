import { api } from '../../lib/axios.js';
import { ApiError } from '../../lib/apiError.js';
import {
  summaryAidSchema,
  flashcardsAidSchema,
  explanationSchema,
  type SummaryAid,
  type FlashcardsAid,
} from './studyAids.schema.js';

/** GET summary/flashcards 404s when nothing has been generated yet for that
 * scope — an expected state for a first visit, not a failure the caller
 * should surface as an error. */
const notFoundToNull = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

export const fetchSummary = (courseId: string, lessonId?: string): Promise<SummaryAid | null> =>
  notFoundToNull(async () => {
    const res = await api.get(`/courses/${courseId}/study-aids/summary`, {
      params: lessonId ? { lessonId } : undefined,
    });
    return summaryAidSchema.parse(res.data.data);
  });

export const generateSummary = async (courseId: string, lessonId?: string): Promise<SummaryAid> => {
  const res = await api.post(`/courses/${courseId}/study-aids/summary`, lessonId ? { lessonId } : {});
  return summaryAidSchema.parse(res.data.data);
};

export const fetchFlashcards = (courseId: string, lessonId?: string): Promise<FlashcardsAid | null> =>
  notFoundToNull(async () => {
    const res = await api.get(`/courses/${courseId}/study-aids/flashcards`, {
      params: lessonId ? { lessonId } : undefined,
    });
    return flashcardsAidSchema.parse(res.data.data);
  });

export const generateFlashcards = async (
  courseId: string,
  lessonId?: string,
): Promise<FlashcardsAid> => {
  const res = await api.post(`/courses/${courseId}/study-aids/flashcards`, lessonId ? { lessonId } : {});
  return flashcardsAidSchema.parse(res.data.data);
};

export const explainConcept = async (
  courseId: string,
  params: { lessonId?: string; topic: string },
): Promise<string> => {
  const res = await api.post(`/courses/${courseId}/study-aids/explain`, params);
  return explanationSchema.parse(res.data.data).explanation;
};
