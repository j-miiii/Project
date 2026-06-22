import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmrController } from './emr.controller';
import { EmrService } from './emr.service';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { Ward } from '../entities/ward.entity';
import { Room } from '../entities/room.entity';
import { Bed } from '../entities/bed.entity';
import { Patient } from '../entities/patient.entity';
import { PatientBedAssignment } from '../entities/patient-bed-assignment.entity';
import { Device } from '../entities/device.entity';
import { DrugOrder } from '../entities/drug-order.entity';
import { PatientVital } from '../entities/patient-vital.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Ward,
      Room,
      Bed,
      Patient,
      PatientBedAssignment,
      Device,
      DrugOrder,
      PatientVital,
    ]),
    AuthModule,
  ],
  controllers: [EmrController],
  providers: [EmrService],
  exports: [EmrService],
})
export class EmrModule {}
