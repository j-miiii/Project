import { Controller, Post, Body, HttpCode, HttpStatus, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UserLoginDto } from '../dto/auth.dto';
import { JwtService } from '@nestjs/jwt';

@ApiTags('인증')
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('api/user/signin')
  @ApiOperation({ summary: '사용자 로그인' })
  @ApiBody({ type: UserLoginDto })
  @ApiResponse({
    status: 200,
    description: '로그인 성공',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          description: 'JWT Access Token (2시간 유효)'
        },
        refresh_token: {
          type: 'string',
          description: 'JWT Refresh Token (30일 유효)'
        },
        user: {
          type: 'object',
          description: '사용자 정보',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            role: { type: 'string' },
            nickname: { type: 'string' },
            hospital_id: { type: 'number' },
            ward_id: { type: 'number' },
            has_emr: { type: 'number' }
          }
        },
        user_setting: {
          type: 'object',
          description: '사용자 알림 설정',
          properties: {
            id: { type: 'number' },
            user_id: { type: 'number' },
            fast_enabled: { type: 'number' },
            fast_threshold: { type: 'number' },
            slow_enabled: { type: 'number' },
            slow_threshold: { type: 'number' },
            default_gatt: { type: 'number' },
            complete_enabled: { type: 'number' },
            complete_threshold: { type: 'number' },
            stop_enabled: { type: 'number' },
            alert_color: { type: 'string' },
            alert_display_time: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: '등록되지 않은 사용자입니다 또는 비밀번호가 일치하지 않습니다' })
  async signinUser(@Body() loginDto: UserLoginDto) {
    return this.authService.signinUser(loginDto.auth_id, loginDto.password);
  }

  @Post('api/user/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '토큰 갱신' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refresh_token: {
          type: 'string',
          description: '리프레시 토큰',
        },
      },
      required: ['refresh_token'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '토큰 갱신 성공',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', description: '새로운 JWT Access Token (2시간 유효)' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '유효하지 않은 리프레시 토큰',
  })
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('api/admin/unlock-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '계정 잠금 해제 (super_admin 전용)' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: '잠금 해제할 사용자 ID',
        },
      },
      required: ['user_id'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '계정 잠금 해제 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        user_id: { type: 'number' },
        unlocked_by: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패 또는 권한 없음' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async unlockAccount(
    @Headers('authorization') authorization: string,
    @Body('user_id') userId: number,
  ) {
    // Authorization 헤더 검증
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('유효하지 않은 토큰');
    }

    const token = authorization.substring(7); // 'Bearer ' 제거

    try {
      // JWT 토큰 검증
      const payload = this.jwtService.verify(token);

      // super_admin 권한 확인
      if (payload.role !== 'super_admin') {
        throw new UnauthorizedException('super_admin 권한이 필요합니다');
      }

      // 계정 잠금 해제 실행
      return await this.authService.unlockAccount(userId, payload.sub);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('유효하지 않은 토큰');
    }
  }
}