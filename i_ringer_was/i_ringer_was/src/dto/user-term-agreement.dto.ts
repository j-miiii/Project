import { IsInt, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateUserTermAgreementDto {
  @ApiProperty({ example: 1, description: '사용자 ID' })
  @IsInt()
  user_id: number;

  @ApiProperty({ example: 1, description: '약관 ID' })
  @IsInt()
  term_id: number;

  @ApiPropertyOptional({ example: '2026-04-13T10:00:00Z', description: '동의 시간' })
  @IsOptional()
  @IsDateString()
  agreed_at?: string;
}

export class UpdateUserTermAgreementDto extends PartialType(CreateUserTermAgreementDto) {}
