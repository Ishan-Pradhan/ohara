import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const generateLessonPlanSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({
    topic: z.string().min(1).max(500),
    durationMinutes: z.number().int().min(10).max(300),
  }),
};

const lessonPlanOutlineSchema = z.object({
  section: z.string(),
  durationMinutes: z.number(),
  description: z.string(),
});

const lessonPlanActivitySchema = z.object({
  name: z.string(),
  type: z.enum(['discussion', 'practice', 'group', 'individual', 'demonstration']),
  description: z.string(),
  durationMinutes: z.number(),
});

const lessonPlanSchema = registry.register(
  'LessonPlan',
  z.object({
    title: z.string(),
    objectives: z.array(z.string()),
    outline: z.array(lessonPlanOutlineSchema),
    activities: z.array(lessonPlanActivitySchema),
    assessmentIdeas: z.array(z.string()),
    materials: z.array(z.string()).optional(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/lesson-plan',
  tags: ['Teacher Intelligence'],
  request: {
    params: generateLessonPlanSchema.params,
    body: { content: { 'application/json': { schema: generateLessonPlanSchema.body } } },
  },
  responses: {
    200: {
      description: 'AI-generated lesson plan for the given topic and duration',
      content: { 'application/json': { schema: envelope(lessonPlanSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});
