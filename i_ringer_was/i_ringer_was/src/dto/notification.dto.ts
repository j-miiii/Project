import { IsInt, IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum NotificationType {
  SLOW = 'slow',
  FAST = 'fast',
  ALMOST_DONE = 'almost_done',
  STOP = 'stop',
  DONE = 'done',
  DISCONNECTED = 'disconnected',
}

export enum NotificationAlertCategory {
  CRITICAL = 'critical',
  CAUTION = 'caution',
  SYSTEM_ERROR = 'system_error',
}

export class CreateNotificationDto {
  @ApiProperty({ example: 1, description: '사용자 ID' })
  @IsInt()
  user_id: number;

  @ApiPropertyOptional({ example: 1, description: '환자 침대 할당 ID' })
  @IsOptional()
  @IsInt()
  patient_bed_assignment_id?: number;

  @ApiPropertyOptional({ example: 1, description: '장치 ID' })
  @IsOptional()
  @IsInt()
  device_id?: number;

  @ApiProperty({ example: '수액 주입 완료', description: '알림 제목' })
  @IsString()
  title: string;

  @ApiProperty({ example: '환자 홍길동의 수액 주입이 완료되었습니다.', description: '알림 메시지' })
  @IsString()
  message: string;

  @ApiProperty({ example: 'almost_done', enum: NotificationType, description: '알림 유형' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({ example: false, description: '읽음 여부' })
  @IsOptional()
  @IsBoolean()
  is_read?: boolean;

  @ApiPropertyOptional({ example: 'caution', enum: NotificationAlertCategory, description: '알림 카테고리' })
  @IsOptional()
  @IsEnum(NotificationAlertCategory)
  alert_category?: NotificationAlertCategory;
}

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}