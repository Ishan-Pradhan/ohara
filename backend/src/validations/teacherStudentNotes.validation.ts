import { z } from 'zod';

export const listMyStudentNotesSchema = {
  params: z.object({ studentId: z.uuid() }),
};

export const createMyStudentNoteSchema = {
  params: z.object({ studentId: z.uuid() }),
  body: z.object({
    content: z.string().min(1, 'Note content is required'),
  }),
};

export const deleteMyStudentNoteSchema = {
  params: z.object({ studentId: z.uuid(), noteId: z.uuid() }),
};
