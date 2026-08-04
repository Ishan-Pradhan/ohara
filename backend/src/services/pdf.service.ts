import { PDFParse } from 'pdf-parse';

/** Extracts all text from a PDF file's raw bytes. */
export const extractText = async (data: Buffer): Promise<string> => {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
};
