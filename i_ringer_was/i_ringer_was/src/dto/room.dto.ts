import { IsString, IsInt } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 1, description: '병동 ID' })
  @IsInt()
  ward_id: number;

  @ApiProperty({ example: '101호', description: '병실 이름' })
  @IsString()
  name: string;

  @ApiProperty({ example: 4, description: '침대 수' })
  @IsInt()
  bed_count: number;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}