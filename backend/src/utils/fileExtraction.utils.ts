import { extractText as extractPdfText } from '../services/pdf.service.js';
import { extractText as extractDocxText } from '../services/docx.service.js';

/** Extracts text from a submission file for AI grading. PDF and DOCX are
 * supported (both are common homework formats with reliable text
 * extraction); spreadsheets and images are stored but return null here —
 * a teacher grades those manually. Not a service itself: it only dispatches
 * to the two services that actually touch a parsing library. */
export const extractSubmissionText = async (
  mimeType: string,
  buffer: Buffer,
): Promise<string | null> => {
  if (mimeType === 'application/pdf') {
    return await extractPdfText(buffer);
  }
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return await extractDocxText(buffer);
  }
  return null;
};

/** Extracts text from a course document for RAG ingestion / course-structure
 * generation. Dispatches on the filename's extension rather than a
 * client-reported MIME type — unlike PDF/DOCX above, a browser/OS's
 * `.md` MIME type is inconsistent (`text/markdown`, `text/plain`, sometimes
 * empty), so the upload filter (`courseDocumentFileFilter`) already
 * validates by extension too; this keeps the two checks consistent. Markdown
 * needs no parsing library — it's already plain text. */
export const extractDocumentText = async (
  filename: string,
  buffer: Buffer,
): Promise<string> => {
  if (filename.toLowerCase().endsWith('.md')) {
    return buffer.toString('utf-8');
  }
  return await extractPdfText(buffer);
};
