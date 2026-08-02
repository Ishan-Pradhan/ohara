import { z } from 'zod';
import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';

// Must run exactly once, before any .openapi() call. Every schema module
// imports `z` from here rather than from 'zod' so that ordering is guaranteed.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();
export { z };
