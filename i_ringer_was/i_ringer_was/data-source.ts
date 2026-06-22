import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  entities: ['src/entities/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  // synchronize: false,
  synchronize: true,
  logging: true,
  timezone: 'Z',
  charset: 'utf8mb4',
});