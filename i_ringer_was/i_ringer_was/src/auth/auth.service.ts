import { Injectable, UnauthorizedException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { AccessToken } from '../entities/access-token.entity';
import { UserSetting } from '../entities/user-setting.entity';
import { WardSetting } from '../entities/ward-setting.entity';
import { UserLockoutStatus } from '../entities/user-lockout-status.entity';
import { UserLockoutLog } from '../entities/user-lockout-log.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  private getUserRepository(): Repository<User> {
    return this.dataSource.getRepository(User);
  }

  private getAccessTokenRepository(): Repository<AccessToken> {
    return this.dataSource.getRepository(AccessToken);
  }

  private getUserSettingRepository(): Repository<UserSetting> {
    return this.dataSource.getRepository(UserSetting);
  }

  private getUserLockoutStatusRepository(): Repository<UserLockoutStatus> {
    return this.dataSource.getRepository(UserLockoutStatus);
  }

  private getUserLockoutLogRepository(): Repository<UserLockoutLog> {
    return this.dataSource.getRepository(UserLockoutLog);
  }

  async signinUser(auth_id: string, password: string) {
    const userRepository = this.getUserRepository();
    const lockoutStatusRepository = this.getUserLockoutStatusRepository();
    const lockoutLogRepository = this.getUserLockoutLogRepository();

    const user = await userRepository.findOne({
      where: { auth_id: auth_id }
    });

    // 아이디가 존재하지 않으면 실패 횟수 카운트 안 함
    if (!user) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 일치하지 않습니다');
    }

    // 계정 잠금 상태 조회 또는 생성
    let lockoutStatus = await lockoutStatusRepository.findOne({
      where: { user_id: user.id }
    });

    if (!lockoutStatus) {
      // 처음 로그인 시도하는 사용자면 lockout_status 생성
      lockoutStatus = await lockoutStatusRepository.save({
        user_id: user.id,
        failure_count: 0,
        is_locked: false,
      });
    }

    // 계정이 잠겨있는지 확인
    if (lockoutStatus.is_locked) {
      throw new UnauthorizedException('계정이 잠겨있습니다. 관리자에게 문의하세요.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // 비밀번호 틀림 → 실패 횟수 증가
      const newFailureCount = lockoutStatus.failure_count + 1;
      const maxAttempts = 5; // 최대 시도 횟수

      if (newFailureCount >= maxAttempts) {
        // 5회 실패 → 계정 잠금
        await lockoutStatusRepository.update(lockoutStatus.id, {
          failure_count: newFailureCount,
          is_locked: true,
        });

        // 잠금 이벤트 로그 기록
        await lockoutLogRepository.save({
          user_id: user.id,
          event_type: 'LOCKED',
          changed_by: 'SYSTEM',
        });

        throw new UnauthorizedException('비밀번호 5회 오류로 계정이 잠겼습니다. 관리자에게 문의하세요.');
      } else {
        // 아직 5회 미만 → 실패 횟수만 증가
        await lockoutStatusRepository.update(lockoutStatus.id, {
          failure_count: newFailureCount,
        });

        throw new UnauthorizedException(`아이디 또는 비밀번호가 일치하지 않습니다. (${maxAttempts - newFailureCount}회 남음)`);
      }
    }

    // 로그인 성공 → 실패 횟수 초기화
    if (lockoutStatus.failure_count > 0) {
      await lockoutStatusRepository.update(lockoutStatus.id, {
        failure_count: 0,
      });
    }

    const payload = {
      email: user.auth_id,
      sub: user.id,
      role: user.role,
      type: 'user'
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '2h' });

    const refreshPayload = { sub: user.id, type: 'user_refresh' };
    const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: '30d' });

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);

    const accessTokenRepository = this.getAccessTokenRepository();

    const existingToken = await accessTokenRepository.findOne({
      where: { user_id: user.id }
    });

    if (existingToken) {
      await accessTokenRepository.update(existingToken.id, {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: refreshExpiresAt,
      });
    } else {
      await accessTokenRepository.save({
        user_id: user.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: refreshExpiresAt,
      });
    }

    // user_settings 조회
    const userSettingRepository = this.getUserSettingRepository();
    const userSetting = await userSettingRepository.findOne({
      where: { user_id: user.id }
    });

    // ward_settings 조회
    let wardSetting = null;
    if (user.ward_id) {
      const wardSettingRepository = this.dataSource.getRepository(WardSetting);
      wardSetting = await wardSettingRepository.findOne({
        where: { ward_id: user.ward_id }
      });
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.auth_id,
        role: user.role,
        nickname: user.nickname,
        hospital_id: user.hospital_id,
        ward_id: user.ward_id,
        has_emr: user.has_emr,
      },
      user_setting: userSetting || null,
      ward_setting: wardSetting || null,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      if (payload.type !== 'user_refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const userRepository = this.getUserRepository();
      const user = await userRepository.findOne({
        where: { id: payload.sub }
      });

      if (!user) {
        throw new UnauthorizedException('사용자를 찾을 수 없습니다');
      }

      // DB에 저장된 refresh token 확인
      const accessTokenRepository = this.getAccessTokenRepository();
      const tokenRecord = await accessTokenRepository.findOne({
        where: {
          user_id: user.id,
          refresh_token: refreshToken
        }
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('유효하지 않은 리프레시 토큰');
      }

      // refresh token 만료 확인
      if (tokenRecord.expires_at < new Date()) {
        throw new UnauthorizedException('만료된 리프레시 토큰');
      }

      // 새로운 access token 생성
      const newPayload = {
        email: user.auth_id,
        sub: user.id,
        role: user.role,
        type: 'user'
      };

      const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '2h' });

      // access_tokens 테이블 업데이트
      await accessTokenRepository.update(tokenRecord.id, {
        access_token: newAccessToken
      });

      return {
        access_token: newAccessToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // 계정 잠금 해제 (super_admin 전용)
  async unlockAccount(userId: number, adminUserId: number) {
    const lockoutStatusRepository = this.getUserLockoutStatusRepository();
    const lockoutLogRepository = this.getUserLockoutLogRepository();
    const userRepository = this.getUserRepository();

    // 대상 사용자 존재 확인
    const targetUser = await userRepository.findOne({
      where: { id: userId }
    });

    if (!targetUser) {
      throw new NotFoundException('해당 사용자를 찾을 수 없습니다');
    }

    // 잠금 상태 조회
    const lockoutStatus = await lockoutStatusRepository.findOne({
      where: { user_id: userId }
    });

    if (!lockoutStatus) {
      throw new NotFoundException('계정 잠금 정보가 없습니다');
    }

    if (!lockoutStatus.is_locked) {
      throw new HttpException('이미 잠금 해제된 계정입니다', HttpStatus.BAD_REQUEST);
    }

    // 잠금 해제 처리
    await lockoutStatusRepository.update(lockoutStatus.id, {
      is_locked: false,
      failure_count: 0, // 실패 횟수도 초기화
    });

    // 잠금 해제 이벤트 로그 기록
    await lockoutLogRepository.save({
      user_id: userId,
      event_type: 'UNLOCKED',
      changed_by: `admin_${adminUserId}`,
    });

    return {
      message: '계정 잠금이 해제되었습니다',
      user_id: userId,
      unlocked_by: adminUserId,
    };
  }
}