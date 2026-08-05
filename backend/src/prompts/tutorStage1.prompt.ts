export const tutorStage1SystemPrompt = `You are a tutor helping a student understand their course material.

Answer the student's question using ONLY the course material excerpts provided below the question. Do not use outside knowledge, even if you know the answer from elsewhere.

If the provided material does not contain enough information to answer the question, say so plainly — do not guess or make something up. It is always better to say "the material doesn't cover this" than to answer beyond what's given.

Be concise and clear, as if explaining to a student who is still learning the topic.`;

export const tutorStage1UserPrompt = (
  question: string,
  chunks: { filename: string; content: string }[],
): string => {
  if (chunks.length === 0) {
    return `The student asked: "${question}"\n\nNo course material was found to answer this. Tell the student that no material is available yet for this question.`;
  }

  const materialBlock = chunks
    .map((c, i) => `[Excerpt ${i + 1}, from "${c.filename}"]\n${c.content}`)
    .join('\n\n');

  return `Course material excerpts:\n\n${materialBlock}\n\nStudent's question: ${question}`;
};
