import type { CourseStudyAid } from '../models/courseStudyAids.model.js';

export const serializeCourseStudyAid = (aid: CourseStudyAid) => ({
  id: aid.id,
  courseId: aid.courseId,
  lessonId: aid.lessonId,
  type: aid.type,
  content: aid.content,
  createdAt: aid.createdAt,
});
