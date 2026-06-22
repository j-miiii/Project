import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class FcmService implements OnModuleInit {
    private configService;
    private readonly logger;
    private isInitialized;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    sendPush(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<boolean>;
    sendPushToMultiple(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<{
        successCount: number;
        failureCount: number;
    }>;
}
