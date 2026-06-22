import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum DrugOrderStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export class CreateDrugOrderDto {
  @ApiProperty({ example: 1, description: '환자 ID' })
  @IsInt()
  patient_id: number;

  @ApiProperty({ example: 1, description: '수액 종류 ID (infusions FK)' })
  @IsInt()
  infusion_id: number;

  @ApiPropertyOptional({ example: 'ORD001', description: '처방 코드' })
  @IsOptional()
  @IsString()
  order_code?: string;

  @ApiPropertyOptional({ example: 500, description: '처방 용량 (ml)' })
  @IsOptional()
  @IsInt()
  volume?: number;

  @ApiPropertyOptional({ example: 60, description: '처방 유속 (gtt/min)' })
  @IsOptional()
  @IsInt()
  gtt?: number;

  @ApiPropertyOptional({ example: 164.10, description: '처방 유속 (ml/hr)' })
  @IsOptional()
  cchr?: number;

  @ApiPropertyOptional({ example: '20260414', description: '처방 일자 (YYYYMMDD)' })
  @IsOptional()
  @IsString()
  order_date?: string;

  @ApiPropertyOptional({ example: 'active', enum: DrugOrderStatus, description: '처방 상태' })
  @IsOptional()
  @IsEnum(DrugOrderStatus)
  status?: DrugOrderStatus;
}

export class UpdateDrugOrderDto extends PartialType(CreateDrugOrderDto) {}
