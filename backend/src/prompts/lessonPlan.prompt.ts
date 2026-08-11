export const lessonPlanSystemPrompt = `You are an experienced educator creating detailed lesson plans. Given a topic, duration, and optional course context, produce a structured, practical lesson plan. Be specific and age-appropriate. Match the depth and complexity to the stated duration.`;

export const lessonPlanUserPrompt = (data: {
  topic: string;
  durationMinutes: number;
  courseTitle?: string;
  courseDescription?: string;
}): string =>
  `Course: ${data.courseTitle ?? 'General'}
${data.courseDescription ? `Course description: ${data.courseDescription}` : ''}
Topic: ${data.topic}
Duration: ${data.durationMinutes} minutes

Create a structured lesson plan with:
- A clear, descriptive title
- 3-5 specific learning objectives
- A timed outline breaking the lesson into sections (total must equal ${data.durationMinutes} minutes)
- 2-4 interactive activities with types (discussion, practice, group, individual, demonstration) and timing
- 1-3 assessment ideas to check understanding
- An optional materials list

Return as JSON with keys: title, objectives, outline (array of {section, durationMinutes, description}), activities (array of {name, type, description, durationMinutes}), assessmentIdeas, materials.`;

export const lessonPlanSchema = {
  type: 'object' as const,
  properties: {
    title: { type: 'string' },
    objectives: { type: 'array' as const, items: { type: 'string' } },
    outline: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          section: { type: 'string' },
          durationMinutes: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['section', 'durationMinutes', 'description'],
      },
    },
    activities: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          type: { type: 'string' as const, enum: ['discussion', 'practice', 'group', 'individual', 'demonstration'] },
          description: { type: 'string' },
          durationMinutes: { type: 'number' },
        },
        required: ['name', 'type', 'description', 'durationMinutes'],
      },
    },
    assessmentIdeas: { type: 'array' as const, items: { type: 'string' } },
    materials: { type: 'array' as const, items: { type: 'string' } },
  },
  required: ['title', 'objectives', 'outline', 'activities', 'assessmentIdeas'],
};
