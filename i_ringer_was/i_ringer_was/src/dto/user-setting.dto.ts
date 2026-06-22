import { IsInt, IsBoolean, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateUserSettingDto {
  @ApiProperty({ example: 1, description: '사용자 ID' })
  @IsInt()
  user_id: number;

  @ApiPropertyOptional({ example: true, description: '빠른 주입 알림 활성화' })
  @IsOptional()
  @IsBoolean()
  fast_enabled?: boolean;

  @ApiPropertyOptional({ example: 50, description: '빠른 주입 임계값(%)' })
  @IsOptional()
  @IsInt()
  fast_threshold?: number;

  @ApiPropertyOptional({ example: true, description: '느린 주입 알림 활성화' })
  @IsOptional()
  @IsBoolean()
  slow_enabled?: boolean;

  @ApiPropertyOptional({ example: -50, description: '느린 주입 임계값(%)' })
  @IsOptional()
  @IsInt()
  slow_threshold?: number;

  @ApiPropertyOptional({ example: 60, description: '기본 유속(ml/h)' })
  @IsOptional()
  @IsInt()
  default_gatt?: number;

  @ApiPropertyOptional({ example: 164.10, description: '기본 유속 CCHR (ml/hr)' })
  @IsOptional()
  default_cchr?: number;

  @ApiPropertyOptional({ example: true, description: '완료 알림 활성화' })
  @IsOptional()
  @IsBoolean()
  complete_enabled?: boolean;

  @ApiPropertyOptional({ example: 95, description: '완료 알림 임계값(%)' })
  @IsOptional()
  @IsInt()
  complete_threshold?: number;

  @ApiPropertyOptional({ example: true, description: '중단 알림 활성화' })
  @IsOptional()
  @IsBoolean()
  stop_enabled?: boolean;

  @ApiPropertyOptional({ example: '#FF0000', description: '알림 색상' })
  @IsOptional()
  @IsString()
  alert_color?: string;

  @ApiPropertyOptional({ example: 5, description: '알림 표시 시간(초)' })
  @IsOptional()
  @IsInt()
  alert_display_time?: number;

  @ApiPropertyOptional({ example: 1, description: '위급 알림 활성화' })
  @IsOptional()
  @IsInt()
  critical_alert_enabled?: number;

  @ApiPropertyOptional({ example: 1, description: '위급 소리 활성화' })
  @IsOptional()
  @IsInt()
  critical_sound_enabled?: number;

  @ApiPropertyOptional({ example: 100, description: '위급 소리 볼륨 (0~100)' })
  @IsOptional()
  @IsInt()
  critical_sound_volume?: number;

  @ApiPropertyOptional({ example: 1, description: '주의 알림 활성화' })
  @IsOptional()
  @IsInt()
  caution_alert_enabled?: number;

  @ApiPropertyOptional({ example: 1, description: '주의 소리 활성화' })
  @IsOptional()
  @IsInt()
  caution_sound_enabled?: number;

  @ApiPropertyOptional({ example: 100, description: '주의 소리 볼륨 (0~100)' })
  @IsOptional()
  @IsInt()
  caution_sound_volume?: number;

  @ApiPropertyOptional({ example: 1, description: '시스템오류 알림 활성화' })
  @IsOptional()
  @IsInt()
  system_error_alert_enabled?: number;

  @ApiPropertyOptional({ example: 1, description: '시스템오류 소리 활성화' })
  @IsOptional()
  @IsInt()
  system_error_sound_enabled?: number;

  @ApiPropertyOptional({ example: 100, description: '시스템오류 소리 볼륨 (0~100)' })
  @IsOptional()
  @IsInt()
  system_error_sound_volume?: number;

  @ApiPropertyOptional({ example: 'percentage', description: "수액량 표시 모드 ('percentage' / 'ml')" })
  @IsOptional()
  @IsString()
  volume_display_mode?: string;
}

export class UpdateUserSettingDto extends PartialType(CreateUserSettingDto) {}