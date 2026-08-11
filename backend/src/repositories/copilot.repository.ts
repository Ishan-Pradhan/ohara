import { TeacherCopilotConversation, TeacherCopilotMessage } from '../models/teacherCopilotConversation.model.js';

export const copilotRepository = {
  createConversation: async (courseId: string, teacherId: string): Promise<TeacherCopilotConversation> => {
    return await TeacherCopilotConversation.create({ courseId, teacherId });
  },

  findConversation: async (id: string): Promise<TeacherCopilotConversation | null> => {
    return await TeacherCopilotConversation.findByPk(id);
  },

  findConversationWithMessages: async (id: string): Promise<TeacherCopilotConversation | null> => {
    return await TeacherCopilotConversation.findByPk(id, {
      include: [
        {
          model: TeacherCopilotMessage,
          as: 'messages',
          order: [['seq', 'ASC']],
        },
      ],
    });
  },

  findTeacherConversations: async (courseId: string, teacherId: string): Promise<TeacherCopilotConversation[]> => {
    return await TeacherCopilotConversation.findAll({
      where: { courseId, teacherId },
      order: [['createdAt', 'DESC']],
    });
  },

  createMessage: async (
    conversationId: string,
    seq: number,
    role: 'user' | 'assistant',
    content: string,
    dataContext?: Record<string, unknown>,
  ): Promise<TeacherCopilotMessage> => {
    return await TeacherCopilotMessage.create({ conversationId, seq, role, content, dataContext: dataContext ?? null });
  },

  getMaxSeq: async (conversationId: string): Promise<number> => {
    const last = await TeacherCopilotMessage.findOne({
      where: { conversationId },
      order: [['seq', 'DESC']],
      attributes: ['seq'],
    });
    return last?.seq ?? 0;
  },

  deleteConversation: async (id: string): Promise<boolean> => {
    const deleted = await TeacherCopilotConversation.destroy({ where: { id } });
    return deleted > 0;
  },
};
