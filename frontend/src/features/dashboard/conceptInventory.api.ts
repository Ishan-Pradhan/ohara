import { api } from '../../lib/axios.js';
import { conceptInventorySchema, type ConceptInventory } from './conceptInventory.schema.js';

export const fetchConceptInventory = async (): Promise<ConceptInventory> => {
  const res = await api.get('/dashboard/me/concepts');
  return conceptInventorySchema.parse(res.data.data);
};
