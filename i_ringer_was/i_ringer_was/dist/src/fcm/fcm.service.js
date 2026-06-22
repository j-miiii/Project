"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FcmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FcmService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const admin = require("firebase-admin");
let FcmService = FcmService_1 = class FcmService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(FcmService_1.name);
        this.isInitialized = false;
    }
    onModuleInit() {
        const serviceAccountPath = this.configService.get('FIREBASE_SERVICE_ACCOUNT_PATH');
        if (!serviceAccountPath) {
            this.logger.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_PATH not set. FCM push disabled.');
            return;
        }
        try {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            this.isInitialized = true;
            this.logger.log('[FCM] Firebase Admin initialized successfully');
        }
        catch (error) {
            this.logger.error(`[FCM] Failed to initialize Firebase Admin: ${error.message}`);
        }
    }
    async sendPush(fcmToken, title, body, data) {
        if (!this.isInitialized) {
            this.logger.warn('[FCM] Not initialized, skipping push');
            return false;
        }
        if (!fcmToken) {
            this.logger.warn('[FCM] No FCM token provided, skipping push');
            return false;
        }
        try {
            const message = {
                token: fcmToken,
                data: {
                    title,
                    body,
                    ...(data || {}),
                },
                android: {
                    priority: 'high',
                },
            };
            const response = await admin.messaging().send(message);
            this.logger.log(`[FCM] Push sent successfully: ${response}`);
            return true;
        }
        catch (error) {
            this.logger.error(`[FCM] Failed to send push to token ${fcmToken.substring(0, 10)}...: ${error.message}`);
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                this.logger.warn(`[FCM] Token invalid or expired: ${fcmToken.substring(0, 10)}...`);
            }
            return false;
        }
    }
    async sendPushToMultiple(tokens, title, body, data) {
        if (!this.isInitialized) {
            this.logger.warn('[FCM] Not initialized, skipping push');
            return { successCount: 0, failureCount: 0 };
        }
        const validTokens = tokens.filter(t => t);
        if (validTokens.length === 0) {
            this.logger.warn('[FCM] No valid tokens, skipping push');
            return { successCount: 0, failureCount: 0 };
        }
        let successCount = 0;
        let failureCount = 0;
        for (const token of validTokens) {
            const result = await this.sendPush(token, title, body, data);
            if (result) {
                successCount++;
            }
            else {
                failureCount++;
            }
        }
        this.logger.log(`[FCM] Batch send complete: ${successCount} success, ${failureCount} failed`);
        return { successCount, failureCount };
    }
};
exports.FcmService = FcmService;
exports.FcmService = FcmService = FcmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FcmService);
//# sourceMappingURL=fcm.service.js.map