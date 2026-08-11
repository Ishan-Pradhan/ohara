const SCHEMA_DESCRIPTION = `{
  "questions": [
    {
      "type": "mcq",
      "prompt": "string — the question",
      "options": ["string", "string", "..."],
      "correctIndex": "number — index into options of the correct choice",
      "points": "number — points for this question",
      "difficulty": "easy | medium | hard",
      "cognitiveLevel": "remember | understand | apply | analyze | evaluate | create"
    },
    {
      "type": "short_answer",
      "prompt": "string — the question",
      "points": "number — points for this question",
      "difficulty": "easy | medium | hard",
      "cognitiveLevel": "remember | understand | apply | analyze | evaluate | create"
    }
  ]
}`;

export interface QuizGenerationOptions {
  numQuestions: number;
  allowedTypes: string[];
  difficulty?: string;
  cognitiveDistribution?: Record<string, number>;
  pointsPerQuestion?: number;
  learningObjectives?: string[];
}

export const quizGenerationSystemPrompt = (opts: QuizGenerationOptions): string => {
  const lines = [
    'You are writing a quiz for a teacher to review before publishing to students.',
    '',
    'Read the provided source material and produce a JSON object with this exact shape:',
    SCHEMA_DESCRIPTION,
    '',
    'Rules:',
    `- Produce exactly ${opts.numQuestions} questions, using only these question types: ${opts.allowedTypes.join(', ')}.`,
    '- Every "mcq" question must have between 3 and 5 "options", with exactly one correct answer at "correctIndex".',
    '- Questions must be answerable from the source material — do not invent facts not present in it.',
    '- Vary phrasing; do not repeat the same fact across multiple questions.',
  ];

  if (opts.difficulty && opts.difficulty !== 'mixed') {
    lines.push(`- Set every question's "difficulty" to "${opts.difficulty}".`);
  } else {
    lines.push('- Vary difficulty across questions: mix easy, medium, and hard questions.');
  }

  if (opts.cognitiveDistribution && Object.values(opts.cognitiveDistribution).some((v) => v > 0)) {
    const dist = Object.entries(opts.cognitiveDistribution)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    lines.push(`- Distribute cognitive levels as follows: ${dist}. Each question must have a "cognitiveLevel" field.`);
  } else {
    lines.push('- Assign each question a "cognitiveLevel" from: remember, understand, apply, analyze, evaluate, create. Vary the levels.');
  }

  if (opts.pointsPerQuestion && opts.pointsPerQuestion !== 1) {
    lines.push(`- Set each question's "points" to ${opts.pointsPerQuestion}.`);
  } else {
    lines.push('- Assign "points" to each question based on difficulty: easy=1, medium=2, hard=3.');
  }

  if (opts.learningObjectives && opts.learningObjectives.length > 0) {
    lines.push(`- Ensure questions align with these learning objectives: ${opts.learningObjectives.join('; ')}.`);
  }

  lines.push('- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.');

  return lines.join('\n');
};

export const quizGenerationUserPrompt = (sourceText: string): string =>
  `Source material:\n\n${sourceText}`;

export const quizGenerationCorrectivePrompt = (invalidResponse: string): string =>
  `Your previous response was not valid JSON matching the required shape. Here is what you sent:\n\n${invalidResponse}\n\nRespond again with ONLY a JSON object matching this exact shape, and nothing else:\n${SCHEMA_DESCRIPTION}`;
