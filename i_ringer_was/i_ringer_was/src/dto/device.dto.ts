import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error'
}

export class CreateDeviceDto {
  @ApiProperty({ example: 'I-Ringer-001', description: '장치 이름' })
  @IsString()
  device_name: string;

  @ApiProperty({ example: 'IR001', description: '시리얼 번호' })
  @IsString()
  serial_number: string;

  @ApiProperty({ example: 'online', enum: NetworkStatus, description: '네트워크 상태' })
  @IsEnum(NetworkStatus)
  network_status: NetworkStatus;

  @ApiPropertyOptional({ example: 85, description: '배터리 잔량(%)' })
  @IsOptional()
  @IsInt()
  battery_percent?: number;

  @ApiPropertyOptional({ example: '1.0.0', description: '펌웨어 버전' })
  @IsOptional()
  @IsString()
  firmware_version?: string;

  @ApiPropertyOptional({ example: '1', description: '침대 ID' })
  @IsOptional()
  @IsString()
  bed_id?: string;

  @ApiPropertyOptional({ example: 51, description: '병동 ID' })
  @IsOptional()
  @IsInt()
  ward_id?: number;

  @ApiPropertyOptional({ example: 101, description: '병실 ID' })
  @IsOptional()
  @IsInt()
  room_id?: number;

  @ApiPropertyOptional({ example: 21, description: '병원 ID' })
  @IsOptional()
  @IsInt()
  hospital_id?: number;
}

export class UpdateDeviceDto extends PartialType(CreateDeviceDto) {}