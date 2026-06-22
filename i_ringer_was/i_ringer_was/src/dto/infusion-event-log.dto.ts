import { IsInt, IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum InfusionEventType {
  START = 'start',
  PAUSE = 'pause',
  RESUME = 'resume',
  COMPLETE = 'complete',
  CANCEL = 'cancel',
  ALERT = 'alert',
  MODIFY = 'modify',
}

export class CreateInfusionEventLogDto {
  @ApiProperty({ example: 1, description: '환자 침대 배정 ID' })
  @IsInt()
  patient_bed_assignment_id: number;

  @ApiProperty({ example: 'start', enum: InfusionEventType, description: '이벤트 유형' })
  @IsEnum(InfusionEventType)
  event_type: InfusionEventType;

  @ApiPropertyOptional({ example: null, description: '변경 전 값 (JSON)' })
  @IsOptional()
  @IsObject()
  before_value?: any;

  @ApiPropertyOptional({ example: { status: 'infusing' }, description: '변경 후 값 (JSON)' })
  @IsOptional()
  @IsObject()
  after_value?: any;

  @ApiPropertyOptional({ example: 1, description: '수행자 (간호사 user_id)' })
  @IsOptional()
  @IsInt()
  performed_by?: number;
}

export class UpdateInfusionEventLogDto extends PartialType(CreateInfusionEventLogDto) {}
