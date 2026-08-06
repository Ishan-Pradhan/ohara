import mammoth from 'mammoth';

/** Extracts all text from a .docx file's raw bytes. Mirrors pdf.service.ts's shape. */
export const extractText = async (data: Buffer): Promise<string> => {
  const result = await mammoth.extractRawText({ buffer: data });
  return result.value;
};
