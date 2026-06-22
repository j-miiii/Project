import { IsInt, IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateNurseRoomAssignmentDto {
  @ApiProperty({ example: 1, description: '간호사 user_id' })
  @IsInt()
  user_id: number;

  @ApiProperty({ example: 1, description: '병실 ID' })
  @IsInt()
  room_id: number;

  @ApiPropertyOptional({ example: true, description: '활성 여부', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: '2026-04-13T09:00:00Z', description: '배정 시간' })
  @IsOptional()
  @IsDateString()
  assigned_at?: string;

  @ApiPropertyOptional({ example: null, description: '해제 시간' })
  @IsOptional()
  @IsDateString()
  released_at?: string;
}

export class UpdateNurseRoomAssignmentDto extends PartialType(CreateNurseRoomAssignmentDto) {}
