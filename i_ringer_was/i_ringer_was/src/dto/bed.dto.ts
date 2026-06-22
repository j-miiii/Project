import { IsString, IsInt, IsEnum } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export enum BedStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance'
}

export class CreateBedDto {
  @ApiProperty({ example: 1, description: '병실 ID' })
  @IsInt()
  room_id: number;

  @ApiProperty({ example: 'A1', description: '침대 번호' })
  @IsString()
  bed_number: string;

  @ApiProperty({ example: 'available', enum: BedStatus, description: '침대 상태' })
  @IsEnum(BedStatus)
  status: BedStatus;
}

export class UpdateBedDto extends PartialType(CreateBedDto) {}