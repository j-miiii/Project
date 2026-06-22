import { IsInt, IsDateString, IsNumber, IsString, IsEnum } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export enum AlarmType {
  NORMAL = 'normal',
  FAST = 'fast',
  SLOW = 'slow',
  COMPLETE = 'complete',
  ERROR = 'error'
}

export class CreateInfusionLogDto {
  @ApiProperty({ example: 1, description: '장치 ID' })
  @IsInt()
  device_id: number;

  @ApiProperty({ example: 1, description: '환자 침대 할당 ID' })
  @IsInt()
  patient_bed_assignment_id: number;

  @ApiProperty({ example: '2025-09-04T14:00:00Z', description: '로그 시간' })
  @IsDateString()
  log_time: string;

  @ApiProperty({ example: 60.5, description: '유속(ml/h)' })
  @IsNumber()
  flow_rate: number;

  @ApiProperty({ example: 250, description: '주입량(ml)' })
  @IsNumber()
  infused_volume: number;

  @ApiProperty({ example: 'normal', enum: AlarmType, description: '알람 유형' })
  @IsEnum(AlarmType)
  alarm_type: AlarmType;
}

export class UpdateInfusionLogDto extends PartialType(CreateInfusionLogDto) {}