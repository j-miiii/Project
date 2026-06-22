import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserLoginDto {
  @ApiProperty({ 
    example: 'nurse001', 
    description: '사용자 아이디(auth_id)' 
  })
  @IsString()
  @IsNotEmpty()
  auth_id: string;

  @ApiProperty({ 
    example: 'password123', 
    description: '비밀번호' 
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}