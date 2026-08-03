import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';

import { env } from './env.js';
import { User } from '../models/users.model.js';
import { Verification } from '../models/verification.model.js';
import { Program } from '../models/programs.model.js';
import { Class } from '../models/classes.model.js';

// Under test the app must talk to the throwaway test database. Without this
// the integration suites connect to - and truncate - the development database,
// because they share this Sequelize instance.
const database =
  env.NODE_ENV === 'test' && env.DB_NAME_TEST ? env.DB_NAME_TEST : env.DB_NAME;

export const sequelize = new Sequelize({
  database,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'postgres',
  logging: false,
  models: [User, Verification, Program, Class],
});
