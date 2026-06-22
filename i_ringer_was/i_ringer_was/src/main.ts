import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger.config';

// 한국 시간대 설정
process.env.TZ = 'Asia/Seoul';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose']
  });

  app.enableCors({
    origin: ['http://localhost:3005', 
      'http://localhost:3006', 
      'http://localhost:3007', 
      'https://iringer.kr', 
      'http://iringer.kr',
      'http://220.93.155.150:3006'],
    //origin: '*',
    //'http://221.144.5.65:3006'
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'I-Ringer API 문서',
    customfavIcon: 'https://avatars.githubusercontent.com/u/6936373?s=200&v=4',
  });

  const port = process.env.PORT || 3000;

  try {
    await app.listen(port, '0.0.0.0');

    const host = `http://localhost:${port}`;

    console.log(`🏥 I-Ringer API is running on port ${port}`);
    console.log(`📚 Swagger UI: ${host}/api-docs`);
    console.log(`📄 Swagger JSON: ${host}/api-docs/swagger-json`);
    console.log(`✅ Application started successfully`);
  } catch (error) {
    console.error(`❌ Failed to start application:`, error);
    process.exit(1);
  }
}

bootstrap();