import { TutorMessage } from '../models/tutorMessages.model.js';
import type { TutorMessageCreationAttributes } from '../types/tutor.types.js';

export const tutorMessageRepository = {
  create: async (data: TutorMessageCreationAttributes): Promise<TutorMessage> => {
    return await TutorMessage.create(data);
  },

  findAllByConversation: async (conversationId: string): Promise<TutorMessage[]> => {
    return await TutorMessage.findAll({
      where: { conversationId },
      order: [['seq', 'ASC']],
    });
  },

  findById: async (id: string): Promise<TutorMessage | null> => {
    return await TutorMessage.findByPk(id);
  },

  /** Next sequence number for a new message in this conversation. */
  nextSeq: async (conversationId: string): Promise<number> => {
    const max = await TutorMessage.max('seq', { where: { conversationId } });
    return (typeof max === 'number' ? max : -1) + 1;
  },
};
