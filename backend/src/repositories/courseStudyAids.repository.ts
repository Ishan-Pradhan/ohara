import { CourseStudyAid } from '../models/courseStudyAids.model.js';
import type { CourseStudyAidCreationAttributes, StudyAidType } from '../types/courseStudyAids.types.js';

export const courseStudyAidRepository = {
  /** Scoped by (courseId, lessonId, type) — `lessonId: null` means the
   * course-wide aid, not "any lesson." This is the cache lookup every
   * generate endpoint checks before ever calling the LLM. */
  findOne: async (
    courseId: string,
    lessonId: string | null,
    type: StudyAidType,
  ): Promise<CourseStudyAid | null> => {
    return await CourseStudyAid.findOne({ where: { courseId, lessonId, type } });
  },

  create: async (data: CourseStudyAidCreationAttributes): Promise<CourseStudyAid> => {
    return await CourseStudyAid.create(data);
  },
};
