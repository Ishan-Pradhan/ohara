import { app } from './app.js';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';
import { sequelize } from './config/db.js';

const connectDB = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ err: error }, 'DB connection failed');
    process.exit(1);
  }
};

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(env.PORT, () => {
    logger.info(`app is listening at ${env.PORT}`);
  });
};

void start();
