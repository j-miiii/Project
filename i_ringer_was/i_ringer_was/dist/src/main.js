"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const swagger_config_1 = require("./config/swagger.config");
process.env.TZ = 'Asia/Seoul';
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose']
    });
    app.enableCors({
        origin: ['http://localhost:3005',
            'http://localhost:3006',
            'http://localhost:3007',
            'https://iringer.kr',
            'http://iringer.kr',
            'http://220.93.155.150:3006'],
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
    }));
    const document = swagger_1.SwaggerModule.createDocument(app, swagger_config_1.swaggerConfig);
    swagger_1.SwaggerModule.setup('api-docs', app, document, {
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
    }
    catch (error) {
        console.error(`❌ Failed to start application:`, error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map