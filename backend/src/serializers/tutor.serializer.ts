import type { TutorConversation } from '../models/tutorConversations.model.js';
import type { TutorMessage } from '../models/tutorMessages.model.js';

export const serializeTutorConversation = (c: TutorConversation) => ({
  id: c.id,
  courseId: c.courseId,
  studentId: c.studentId,
  title: c.title,
  status: c.status,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

export const serializeTutorMessage = (m: TutorMessage) => ({
  id: m.id,
  conversationId: m.conversationId,
  seq: m.seq,
  role: m.role,
  type: m.type,
  content: m.content,
  toolCalls: m.toolCalls,
  toolResult: m.toolResult,
  chart: m.chart,
  sources: m.sources,
  createdAt: m.createdAt,
});
