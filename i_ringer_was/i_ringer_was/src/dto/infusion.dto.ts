import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateInfusionDto {
  @ApiPropertyOptional({ example: 'NS', description: '영문 약어' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: '생리식염수', description: '수액명' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 500, description: '기본 용량 (ml)' })
  @IsOptional()
  @IsInt()
  default_volume?: number;

  @ApiPropertyOptional({ example: 60, description: '기본 유속 (gtt/min)' })
  @IsOptional()
  @IsInt()
  default_gtt?: number;

  @ApiPropertyOptional({ example: 200, description: '기본 유속 (cc/hr)' })
  @IsOptional()
  @IsInt()
  default_cchr?: number;

  @ApiPropertyOptional({ example: '0.9% NaCl 용액', description: '설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, description: '활성 여부' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 0, description: '표시순서' })
  @IsOptional()
  @IsInt()
  display_order?: number;

  @ApiPropertyOptional({ example: 0, description: '사용횟수' })
  @IsOptional()
  @IsInt()
  usage_count?: number;
}

export class UpdateInfusionDto extends PartialType(CreateInfusionDto) {}
