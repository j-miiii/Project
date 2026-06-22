import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { AppModule } from '../app.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { Patient } from '../entities/patient.entity';
import { PatientBedAssignment } from '../entities/patient-bed-assignment.entity';
import { Bed } from '../entities/bed.entity';
import { Room } from '../entities/room.entity';
import { Ward } from '../entities/ward.entity';
import { Hospital } from '../entities/hospital.entity';
import { Device } from '../entities/device.entity';
import { User } from '../entities/user.entity';
import { Notification } from '../entities/notification.entity';
import { UserSetting } from '../entities/user-setting.entity';
import { AccessToken } from '../entities/access-token.entity';
import { InfusionRawLog } from '../entities/infusion-raw-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientBedAssignment,
      Bed,
      Room,
      Ward,
      Hospital,
      Device,
      User,
      Notification,
      UserSetting,
      AccessToken,
      InfusionRawLog,
    ]),
    forwardRef(() => AppModule), // AppModule import로 AppService 사용 가능
    forwardRef(() => MqttModule), // MqttModule import로 MqttService 사용 가능
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}