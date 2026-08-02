import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';

import { env } from './env.js';
import { User } from '../models/users.model.js';
import { Verification } from '../models/verification.model.js';

export const sequelize = new Sequelize({
  database: env.DB_NAME,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'postgres',
  logging: false,
  models: [User, Verification],
});
