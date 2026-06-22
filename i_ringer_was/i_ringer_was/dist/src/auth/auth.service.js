"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("typeorm");
const bcrypt = require("bcrypt");
const user_entity_1 = require("../entities/user.entity");
const access_token_entity_1 = require("../entities/access-token.entity");
const user_setting_entity_1 = require("../entities/user-setting.entity");
const ward_setting_entity_1 = require("../entities/ward-setting.entity");
const user_lockout_status_entity_1 = require("../entities/user-lockout-status.entity");
const user_lockout_log_entity_1 = require("../entities/user-lockout-log.entity");
let AuthService = class AuthService {
    constructor(jwtService, dataSource) {
        this.jwtService = jwtService;
        this.dataSource = dataSource;
    }
    getUserRepository() {
        return this.dataSource.getRepository(user_entity_1.User);
    }
    getAccessTokenRepository() {
        return this.dataSource.getRepository(access_token_entity_1.AccessToken);
    }
    getUserSettingRepository() {
        return this.dataSource.getRepository(user_setting_entity_1.UserSetting);
    }
    getUserLockoutStatusRepository() {
        return this.dataSource.getRepository(user_lockout_status_entity_1.UserLockoutStatus);
    }
    getUserLockoutLogRepository() {
        return this.dataSource.getRepository(user_lockout_log_entity_1.UserLockoutLog);
    }
    async signinUser(auth_id, password) {
        const userRepository = this.getUserRepository();
        const lockoutStatusRepository = this.getUserLockoutStatusRepository();
        const lockoutLogRepository = this.getUserLockoutLogRepository();
        const user = await userRepository.findOne({
            where: { auth_id: auth_id }
        });
        if (!user) {
            throw new common_1.UnauthorizedException('아이디 또는 비밀번호가 일치하지 않습니다');
        }
        let lockoutStatus = await lockoutStatusRepository.findOne({
            where: { user_id: user.id }
        });
        if (!lockoutStatus) {
            lockoutStatus = await lockoutStatusRepository.save({
                user_id: user.id,
                failure_count: 0,
                is_locked: false,
            });
        }
        if (lockoutStatus.is_locked) {
            throw new common_1.UnauthorizedException('계정이 잠겨있습니다. 관리자에게 문의하세요.');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            const newFailureCount = lockoutStatus.failure_count + 1;
            const maxAttempts = 5;
            if (newFailureCount >= maxAttempts) {
                await lockoutStatusRepository.update(lockoutStatus.id, {
                    failure_count: newFailureCount,
                    is_locked: true,
                });
                await lockoutLogRepository.save({
                    user_id: user.id,
                    event_type: 'LOCKED',
                    changed_by: 'SYSTEM',
                });
                throw new common_1.UnauthorizedException('비밀번호 5회 오류로 계정이 잠겼습니다. 관리자에게 문의하세요.');
            }
            else {
                await lockoutStatusRepository.update(lockoutStatus.id, {
                    failure_count: newFailureCount,
                });
                throw new common_1.UnauthorizedException(`아이디 또는 비밀번호가 일치하지 않습니다. (${maxAttempts - newFailureCount}회 남음)`);
            }
        }
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
        }
        else {
            await accessTokenRepository.save({
                user_id: user.id,
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: refreshExpiresAt,
            });
        }
        const userSettingRepository = this.getUserSettingRepository();
        const userSetting = await userSettingRepository.findOne({
            where: { user_id: user.id }
        });
        let wardSetting = null;
        if (user.ward_id) {
            const wardSettingRepository = this.dataSource.getRepository(ward_setting_entity_1.WardSetting);
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
    async refreshToken(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken);
            if (payload.type !== 'user_refresh') {
                throw new common_1.UnauthorizedException('Invalid token type');
            }
            const userRepository = this.getUserRepository();
            const user = await userRepository.findOne({
                where: { id: payload.sub }
            });
            if (!user) {
                throw new common_1.UnauthorizedException('사용자를 찾을 수 없습니다');
            }
            const accessTokenRepository = this.getAccessTokenRepository();
            const tokenRecord = await accessTokenRepository.findOne({
                where: {
                    user_id: user.id,
                    refresh_token: refreshToken
                }
            });
            if (!tokenRecord) {
                throw new common_1.UnauthorizedException('유효하지 않은 리프레시 토큰');
            }
            if (tokenRecord.expires_at < new Date()) {
                throw new common_1.UnauthorizedException('만료된 리프레시 토큰');
            }
            const newPayload = {
                email: user.auth_id,
                sub: user.id,
                role: user.role,
                type: 'user'
            };
            const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '2h' });
            await accessTokenRepository.update(tokenRecord.id, {
                access_token: newAccessToken
            });
            return {
                access_token: newAccessToken,
            };
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async unlockAccount(userId, adminUserId) {
        const lockoutStatusRepository = this.getUserLockoutStatusRepository();
        const lockoutLogRepository = this.getUserLockoutLogRepository();
        const userRepository = this.getUserRepository();
        const targetUser = await userRepository.findOne({
            where: { id: userId }
        });
        if (!targetUser) {
            throw new common_1.NotFoundException('해당 사용자를 찾을 수 없습니다');
        }
        const lockoutStatus = await lockoutStatusRepository.findOne({
            where: { user_id: userId }
        });
        if (!lockoutStatus) {
            throw new common_1.NotFoundException('계정 잠금 정보가 없습니다');
        }
        if (!lockoutStatus.is_locked) {
            throw new common_1.HttpException('이미 잠금 해제된 계정입니다', common_1.HttpStatus.BAD_REQUEST);
        }
        await lockoutStatusRepository.update(lockoutStatus.id, {
            is_locked: false,
            failure_count: 0,
        });
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        typeorm_1.DataSource])
], AuthService);
//# sourceMappingURL=auth.service.js.map