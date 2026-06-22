import { IsString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: '간호사', description: '사용자 역할' })
  @IsString()
  role: string;

  @ApiProperty({ example: 'nurse001', description: '인증 ID' })
  @IsString()
  auth_id: string;

  @ApiProperty({ example: 'password123', description: '비밀번호' })
  @IsString()
  password: string;

  @ApiProperty({ example: '김간호사', description: '닉네임' })
  @IsString()
  nickname: string;

  @ApiPropertyOptional({ example: 'H001', description: '병원 ID' })
  @IsOptional()
  @IsString()
  hospital_id?: string;

  @ApiPropertyOptional({ example: 1, description: '병동 ID' })
  @IsOptional()
  @IsInt()
  ward_id?: number;

  @ApiPropertyOptional({ example: 'EMP001', description: '사번 (최초 설정 후 변경 불가)' })
  @IsOptional()
  @IsString()
  employee_number?: string;

  @ApiPropertyOptional({ example: '/images/default_profile.png', description: '프로필 이미지', default: '/images/default_profile.png' })
  @IsOptional()
  @IsString()
  profile_image?: string;

}

export class UpdateUserDto extends PartialType(CreateUserDto) {}