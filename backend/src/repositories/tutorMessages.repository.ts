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

  /** True only for the message with the highest seq in its conversation —
   * the sole message deletable without risking corrupting the agent loop's
   * resumable history (an orphaned tool_call/tool_result pair, or a gap
   * mid-sequence that replay logic was never built to handle). Deleting
   * always happens from the tail, one message at a time. */
  isLatest: async (conversationId: string, messageId: string): Promise<boolean> => {
    const latest = await TutorMessage.findOne({
      where: { conversationId },
      order: [['seq', 'DESC']],
    });
    return latest?.id === messageId;
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await TutorMessage.destroy({ where: { id } });
    return deleted > 0;
  },
};
