import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME_TEST: z.string().min(1).optional(),

  // JWT
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, 'ACCESS_TOKEN_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1),

  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, 'REFRESH_TOKEN_SECRET must be at least 32 chars'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),

  // LLM (Groq) — course structure generation, quiz/grading later, tutor in Phase 4.
  // Model is env-configurable (no schema dependency, unlike the embedding
  // model — see EMBEDDING_MODEL in constants/index.ts for why that one isn't).
  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  // Document uploads (Phase 3) — deployment-tunable limits, no schema dependency.
  MAX_UPLOAD_PDF_BYTES: z.coerce.number().default(20 * 1024 * 1024),
  MAX_LLM_SOURCE_CHARS: z.coerce.number().default(50_000),
  UPLOAD_DIR: z.string().default('uploads'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.url(),

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.url(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(1000),

  // Stricter limiter for /auth/* (NFR-3): brute-force protection on credential
  // and token endpoints. Skipped entirely under NODE_ENV=test.
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(20 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(30),

  // Stricter limiter for tutor messages (NFR-3): each one costs a real LLM
  // call. Skipped entirely under NODE_ENV=test, same as AUTH_RATE_LIMIT_*.
  TUTOR_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  TUTOR_RATE_LIMIT_MAX: z.coerce.number().default(30),

  // Seed data (sequelize-cli seeders read these from process.env directly)
  SEED_ADMIN_EMAIL: z.email().default('admin@ohara.local'),
  SEED_ADMIN_PASSWORD: z.string().min(6).default('changeme123'),

  // Required: CORS allowlist origin, and where OAuth/email links redirect back to.
  FRONTEND_URL: z.url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
