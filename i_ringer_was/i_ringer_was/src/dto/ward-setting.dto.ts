import { IsInt, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateWardSettingDto {
  @ApiProperty({ example: 1, description: '병동 ID' })
  @IsInt()
  ward_id: number;

  @ApiPropertyOptional({ example: 1, description: '빠른 주입 알림 활성화 (0/1)' })
  @IsOptional()
  @IsInt()
  fast_enabled?: number;

  @ApiPropertyOptional({ example: 50, description: '빠른 주입 임계값(%)' })
  @IsOptional()
  @IsInt()
  fast_threshold?: number;

  @ApiPropertyOptional({ example: 1, description: '느린 주입 알림 활성화 (0/1)' })
  @IsOptional()
  @IsInt()
  slow_enabled?: number;

  @ApiPropertyOptional({ example: 50, description: '느린 주입 임계값(%)' })
  @IsOptional()
  @IsInt()
  slow_threshold?: number;

  @ApiPropertyOptional({ example: 1, description: '완료 알림 활성화 (0/1)' })
  @IsOptional()
  @IsInt()
  complete_enabled?: number;

  @ApiPropertyOptional({ example: 95, description: '완료 알림 임계값(%)' })
  @IsOptional()
  @IsInt()
  complete_threshold?: number;

  @ApiPropertyOptional({ example: 1, description: '중단 알림 활성화 (0/1)' })
  @IsOptional()
  @IsInt()
  stop_enabled?: number;

  @ApiPropertyOptional({ example: 60, description: '기본 유속(gtt)' })
  @IsOptional()
  @IsInt()
  default_gatt?: number;

  @ApiPropertyOptional({ example: 164.10, description: '기본 유속(ml/hr)' })
  @IsOptional()
  default_cchr?: number;
}

export class UpdateWardSettingDto extends PartialType(CreateWardSettingDto) {}
