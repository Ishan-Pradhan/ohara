import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { env } from '../src/config/env.js';

export default async function setup(): Promise<void> {
  const testDbName = env.DB_NAME_TEST;
  if (!testDbName) {
    throw new Error('DB_NAME_TEST must be set to run the test suite');
  }

  const admin = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: 'postgres',
  });

  await admin.connect();
  const existing = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [testDbName],
  );
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${testDbName}"`);
  }
  await admin.end();

  execSync('npx sequelize-cli db:migrate --env test', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });
}
