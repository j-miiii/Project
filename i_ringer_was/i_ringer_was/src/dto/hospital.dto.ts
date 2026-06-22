import { IsString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateHospitalDto {
  @ApiProperty({ example: '서울대학교병원', description: '병원 이름' })
  @IsString()
  name: string;
}

export class UpdateHospitalDto extends PartialType(CreateHospitalDto) {}