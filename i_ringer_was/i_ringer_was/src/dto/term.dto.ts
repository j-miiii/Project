import { IsString, IsBoolean, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum TermType {
  PRIVACY = 'privacy',
  SERVICE = 'service',
  MARKETING = 'marketing',
  LOCATION = 'location',
}

export class CreateTermDto {
  @ApiProperty({ example: '개인정보 처리방침', description: '약관 제목' })
  @IsString()
  title: string;

  @ApiProperty({ example: '약관 내용입니다...', description: '약관 내용' })
  @IsString()
  content: string;

  @ApiProperty({ example: '1.0', description: '약관 버전' })
  @IsString()
  version: string;

  @ApiProperty({ example: 'privacy', enum: TermType, description: '약관 유형' })
  @IsEnum(TermType)
  type: TermType;

  @ApiPropertyOptional({ example: true, description: '필수 동의 여부', default: true })
  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @ApiPropertyOptional({ example: true, description: '활성 여부', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: '2026-04-13T00:00:00Z', description: '시행일' })
  @IsOptional()
  @IsDateString()
  effective_at?: string;
}

export class UpdateTermDto extends PartialType(CreateTermDto) {}
