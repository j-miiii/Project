// Polyfill for crypto in Node.js < 19
if (typeof globalThis.crypto === 'undefined') {
  const crypto = require('crypto');
  globalThis.crypto = crypto.webcrypto || crypto;
}

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UnifiedController } from './unified.controller';
import { ModelsController } from './models.controller';
import { AppService } from './app.service';
import { User } from './entities/user.entity';
import { Patient } from './entities/patient.entity';
import { Hospital } from './entities/hospital.entity';
import { Ward } from './entities/ward.entity';
import { Room } from './entities/room.entity';
import { Bed } from './entities/bed.entity';
import { Device } from './entities/device.entity';
import { PatientBedAssignment } from './entities/patient-bed-assignment.entity';
import { InfusionRawLog } from './entities/infusion-raw-log.entity';
import { Notification } from './entities/notification.entity';
import { UserSetting } from './entities/user-setting.entity';
import { AccessToken } from './entities/access-token.entity';
import { UserLockoutStatus } from './entities/user-lockout-status.entity';
import { UserLockoutLog } from './entities/user-lockout-log.entity';
import { PatientVital } from './entities/patient-vital.entity';
import { DrugOrder } from './entities/drug-order.entity';
import { Infusion } from './entities/infusion.entity';
import { NurseRoomAssignment } from './entities/nurse-room-assignment.entity';
import { Term } from './entities/term.entity';
import { UserTermAgreement } from './entities/user-term-agreement.entity';
import { InfusionEventLog } from './entities/infusion-event-log.entity';
import { WardSetting } from './entities/ward-setting.entity';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { MqttModule } from './mqtt/mqtt.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { StatisticsModule } from './statistics/statistics.module';
import { EmrModule } from './emr/emr.module';
import { DeviceStatusScheduler } from './schedulers/device-status.scheduler';
import { FcmModule } from './fcm/fcm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    MqttModule,
    StatisticsModule,
    EmrModule,
    FcmModule,
    forwardRef(() => MonitoringModule), // forwardRef로 순환 참조 방지
    TypeOrmModule.forRootAsync({
      name: 'default',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [
          User,
          Patient,
          Hospital,
          Ward,
          Room,
          Bed,
          Device,
          PatientBedAssignment,
          InfusionRawLog,
          Notification,
          UserSetting,
          AccessToken,
          UserLockoutStatus,
          UserLockoutLog,
          PatientVital,
          DrugOrder,
          Infusion,
          NurseRoomAssignment,
          Term,
          UserTermAgreement,
          InfusionEventLog,
          WardSetting,
        ],
        //synchronize: false,
        synchronize: true,
        logging: false,
        timezone: '+09:00',
        extra: {
          connectionLimit: 10,
        },
      }),
    }),
  ],
  controllers: [AppController, UnifiedController, ModelsController],
  providers: [AppService, DeviceStatusScheduler],
  exports: [AppService], // AppService를 export하여 다른 모듈에서 사용 가능하도록
})
export class AppModule {}