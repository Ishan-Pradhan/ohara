import { AdminCopilotConversation, AdminCopilotMessage } from '../models/adminCopilotConversation.model.js';

export const adminCopilotRepository = {
  createConversation: async (adminId: string): Promise<AdminCopilotConversation> => {
    return await AdminCopilotConversation.create({ adminId });
  },

  findConversation: async (id: string): Promise<AdminCopilotConversation | null> => {
    return await AdminCopilotConversation.findByPk(id);
  },

  findConversationWithMessages: async (id: string): Promise<AdminCopilotConversation | null> => {
    return await AdminCopilotConversation.findByPk(id, {
      include: [
        {
          model: AdminCopilotMessage,
          as: 'messages',
          order: [['seq', 'ASC']],
        },
      ],
    });
  },

  findAdminConversations: async (adminId: string): Promise<AdminCopilotConversation[]> => {
    return await AdminCopilotConversation.findAll({
      where: { adminId },
      order: [['createdAt', 'DESC']],
    });
  },

  /** Last `limit` messages already in the conversation, oldest first — used
   * to give the model short-term memory of the conversation so far (pronoun
   * references like "them", follow-ups like "what about X instead") without
   * paying to replay the whole thread on every turn. */
  findRecentMessages: async (conversationId: string, limit: number): Promise<AdminCopilotMessage[]> => {
    const recent = await AdminCopilotMessage.findAll({
      where: { conversationId },
      order: [['seq', 'DESC']],
      limit,
    });
    return recent.reverse();
  },

  createMessage: async (
    conversationId: string,
    seq: number,
    role: 'user' | 'assistant',
    content: string,
    dataContext?: Record<string, unknown>,
  ): Promise<AdminCopilotMessage> => {
    return await AdminCopilotMessage.create({ conversationId, seq, role, content, dataContext: dataContext ?? null });
  },

  getMaxSeq: async (conversationId: string): Promise<number> => {
    const last = await AdminCopilotMessage.findOne({
      where: { conversationId },
      order: [['seq', 'DESC']],
      attributes: ['seq'],
    });
    return last?.seq ?? 0;
  },

  deleteConversation: async (id: string): Promise<boolean> => {
    const deleted = await AdminCopilotConversation.destroy({ where: { id } });
    return deleted > 0;
  },
};
