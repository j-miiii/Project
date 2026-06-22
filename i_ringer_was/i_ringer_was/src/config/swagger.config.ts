import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('I-Ringer API')
  .setDescription('Hospital IV drip monitoring system API')
  .setVersion('1.0')
  .addServer('/', '기본 서버')
  .addBearerAuth()
  .addTag('통합', '통합 CRUD API - 모든 테이블에 대한 조회, 수정, 삭제')
  .addTag('개별모델 삽입', '개별 모델별 데이터 생성 API')
  .build();