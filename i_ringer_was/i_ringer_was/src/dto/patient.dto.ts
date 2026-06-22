import { IsString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ example: '홍길동', description: '환자 이름' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'P001', description: '차트 번호' })
  @IsString()
  chart_number: string;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}