import { useQuery } from '@tanstack/react-query';

import { fetchConceptInventory } from './conceptInventory.api.js';

export const conceptInventoryKey = ['conceptInventory'] as const;

export const useConceptInventory = () =>
  useQuery({
    queryKey: conceptInventoryKey,
    queryFn: fetchConceptInventory,
  });
