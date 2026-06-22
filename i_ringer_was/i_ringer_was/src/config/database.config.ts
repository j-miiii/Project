import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
  timezone: 'Z',
  charset: 'utf8mb4',
  extra: {
    connectionLimit: 10,
    connectTimeout: 60000, // 60초
    acquireTimeout: 60000, // 60초
    timeout: 60000, // 60초
  },
  // 연결이 끊어졌을 때 자동 재연결
  retryAttempts: 10,
  retryDelay: 3000,
});