import { TutorConversation } from '../models/tutorConversations.model.js';
import type {
  TutorConversationCreationAttributes,
  TutorConversationStatus,
} from '../types/tutor.types.js';

export const tutorConversationRepository = {
  create: async (data: TutorConversationCreationAttributes): Promise<TutorConversation> => {
    return await TutorConversation.create(data);
  },

  findAllForStudentInCourse: async (
    studentId: string,
    courseId: string,
  ): Promise<TutorConversation[]> => {
    return await TutorConversation.findAll({
      where: { studentId, courseId },
      order: [['updatedAt', 'DESC']],
    });
  },

  findById: async (id: string): Promise<TutorConversation | null> => {
    return await TutorConversation.findByPk(id);
  },

  updateStatus: async (
    id: string,
    status: TutorConversationStatus,
  ): Promise<TutorConversation | null> => {
    const conversation = await TutorConversation.findByPk(id);
    if (!conversation) return null;
    return await conversation.update({ status });
  },
};
