import { IsInt, IsString, IsDateString, IsOptional, IsArray, ArrayMinSize, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum AssignmentStatus {
  PENDING = 'pending',
  INFUSING = 'infusing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export enum AlertType {
  STOP = 'stop',
  DONE = 'done',
  FAST = 'fast',
  SLOW = 'slow',
  ALMOST_DONE = 'almost_done',
  DISCONNECTED = 'disconnected',
}

export enum AlertCategory {
  CRITICAL = 'critical',
  CAUTION = 'caution',
  SYSTEM_ERROR = 'system_error',
}

export class BulkReleaseDto {
  @ApiProperty({
    example: [1, 2, 3],
    description: '투여 완료 처리할 patient_bed_assignment ID 배열',
    type: [Number]
  })
  @IsArray()
  @ArrayMinSize(1, { message: '최소 1개 이상의 ID가 필요합니다' })
  @IsInt({ each: true, message: '모든 ID는 정수여야 합니다' })
  ids: number[];
}

export class CreatePatientBedAssignmentDto {
  @ApiProperty({ example: 1, description: '환자 ID' })
  @IsInt()
  patient_id: number;

  @ApiProperty({ example: 1, description: '침대 ID' })
  @IsInt()
  bed_id: number;

  @ApiPropertyOptional({ example: 1, description: '장치 ID' })
  @IsOptional()
  @IsInt()
  device_id?: number;

  @ApiPropertyOptional({ example: '생리식염수', description: '수액 종류' })
  @IsOptional()
  @IsString()
  infusion_type?: string;

  @ApiPropertyOptional({ example: 500, description: '총 수액량(ml)' })
  @IsOptional()
  @IsInt()
  infusion_total_volumn?: number;

  @ApiPropertyOptional({ example: 60.0, description: '처방 GTT (방울/분)', default: 60.0 })
  @IsOptional()
  infusion_gtt?: number;

  @ApiPropertyOptional({ example: 164.10, description: '처방 CCHR (ml/hr)' })
  @IsOptional()
  infusion_cchr?: number;

  @ApiPropertyOptional({ example: '2025-09-04T14:00:00Z', description: '할당 시간' })
  @IsOptional()
  @IsDateString()
  assigned_at?: string;

  @ApiPropertyOptional({ description: '해제 시간' })
  @IsOptional()
  @IsDateString()
  discharged_at?: string;

  @ApiPropertyOptional({ example: 'pending', enum: AssignmentStatus, description: '투여 상태', default: 'pending' })
  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  @ApiPropertyOptional({ example: true, description: '활성 여부', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: '2026-04-13T10:00:00Z', description: '투여 시작 시간' })
  @IsOptional()
  @IsDateString()
  started_at?: string;

  @ApiPropertyOptional({ example: null, description: '투여 중지 시간' })
  @IsOptional()
  @IsDateString()
  stopped_at?: string;

  @ApiPropertyOptional({ example: 'caution', enum: AlertCategory, description: '알림 카테고리' })
  @IsOptional()
  @IsEnum(AlertCategory)
  alert_category?: AlertCategory;
}

export class UpdatePatientBedAssignmentDto extends PartialType(CreatePatientBedAssignmentDto) {}