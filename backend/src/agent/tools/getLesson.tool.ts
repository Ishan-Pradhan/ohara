import { z } from 'zod';
import { lessonRepository } from '../../repositories/lessons.repository.js';
import { moduleRepository } from '../../repositories/modules.repository.js';
import type { AgentTool } from '../../types/agent.types.js';
import type { ToolContext, ToolExecutionResult } from './index.js';

export const getLessonTool: AgentTool = {
  name: 'get_lesson',
  description:
    "Fetch the full content of one specific lesson by its id, when a targeted pull beats a fuzzy search (e.g. the student names a topic that maps to one known lesson from the course outline).",
  parameters: {
    type: 'object',
    properties: {
      lessonId: { type: 'string', description: 'The lesson id, from the course outline' },
    },
    required: ['lessonId'],
  },
};

const argsSchema = z.object({ lessonId: z.uuid() });

export const executeGetLesson = async (
  rawArgs: string,
  ctx: ToolContext,
): Promise<ToolExecutionResult> => {
  const { lessonId } = argsSchema.parse(JSON.parse(rawArgs));

  const lesson = await lessonRepository.findById(lessonId);
  if (!lesson) {
    return { content: 'No lesson found with that id.', sources: null };
  }

  // Course-scoping: a lesson only carries moduleId, so walk up to confirm
  // the module actually belongs to the current course — never trust the
  // model to have only ever seen ids from this course's own outline.
  const module = await moduleRepository.findById(lesson.moduleId);
  if (!module || module.courseId !== ctx.courseId) {
    return { content: 'That lesson is not part of this course.', sources: null };
  }

  return {
    content: `[Lesson: "${lesson.title}"]\n${lesson.content}`,
    sources: [{ documentId: lesson.id, filename: lesson.title, chunkContent: lesson.content }],
  };
};
