import { IsInt, IsString, IsDateString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateAccessTokenDto {
  @ApiProperty({ example: 1, description: '사용자 ID' })
  @IsInt()
  user_id: number;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: '액세스 토큰' })
  @IsString()
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: '리프레시 토큰' })
  @IsString()
  refresh_token: string;

  @ApiProperty({ example: '2025-09-04T15:00:00Z', description: '만료 시간' })
  @IsDateString()
  expires_at: string;
}

export class UpdateAccessTokenDto extends PartialType(CreateAccessTokenDto) {}