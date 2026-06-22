import { IsString, IsInt } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateWardDto {
  @ApiProperty({ example: 1, description: '병원 ID' })
  @IsInt()
  hospital_id: number;

  @ApiProperty({ example: '내과병동', description: '병동 이름' })
  @IsString()
  name: string;
}

export class UpdateWardDto extends PartialType(CreateWardDto) {}