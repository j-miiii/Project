import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private isInitialized = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

    if (!serviceAccountPath) {
      this.logger.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_PATH not set. FCM push disabled.');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.isInitialized = true;
      this.logger.log('[FCM] Firebase Admin initialized successfully');
    } catch (error) {
      this.logger.error(`[FCM] Failed to initialize Firebase Admin: ${error.message}`);
    }
  }

  /**
   * 단일 디바이스에 FCM push 발송
   *
   * @param fcmToken - 대상 디바이스의 FCM 토큰
   * @param title - 알림 제목
   * @param body - 알림 본문
   * @param data - 추가 데이터 페이로드
   */
  async sendPush(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.isInitialized) {
      this.logger.warn('[FCM] Not initialized, skipping push');
      return false;
    }

    if (!fcmToken) {
      this.logger.warn('[FCM] No FCM token provided, skipping push');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
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
    } catch (error) {
      this.logger.error(`[FCM] Failed to send push to token ${fcmToken.substring(0, 10)}...: ${error.message}`);

      // 토큰이 만료/유효하지 않은 경우
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        this.logger.warn(`[FCM] Token invalid or expired: ${fcmToken.substring(0, 10)}...`);
      }

      return false;
    }
  }

  /**
   * 여러 디바이스에 FCM push 일괄 발송
   *
   * @param tokens - FCM 토큰 배열
   * @param title - 알림 제목
   * @param body - 알림 본문
   * @param data - 추가 데이터 페이로드
   */
  async sendPushToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
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
      } else {
        failureCount++;
      }
    }

    this.logger.log(`[FCM] Batch send complete: ${successCount} success, ${failureCount} failed`);
    return { successCount, failureCount };
  }
}
