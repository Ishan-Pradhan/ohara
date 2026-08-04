import { api } from '../../lib/axios.js';
import {
  admittedStudentSchema,
  type AdmitStudentInput,
  type AdmittedStudent,
} from './admission.schema.js';

export const admitStudent = async (input: AdmitStudentInput): Promise<AdmittedStudent> => {
  const res = await api.post('/admin/students/admit', input);
  return admittedStudentSchema.parse(res.data.data);
};
