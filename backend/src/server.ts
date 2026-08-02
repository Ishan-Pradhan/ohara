import { app } from './app.js';
import { env } from './config/env.js';
import { sequelize } from './config/db.js';

const connectDB = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('DB connection failed:', error);
    process.exit(1);
  }
};

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`app is listening at ${env.PORT}`);
  });
};

void start();
