import path from 'node:path';
import fs from 'node:fs/promises';

export const DOCUMENTS_DIR = path.join(process.cwd(), 'uploads', 'documents');

export const ensureDocumentsDir = async (): Promise<void> => {
  await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
};

export const documentFilePath = (documentId: string): string =>
  path.join(DOCUMENTS_DIR, `${documentId}.pdf`);
