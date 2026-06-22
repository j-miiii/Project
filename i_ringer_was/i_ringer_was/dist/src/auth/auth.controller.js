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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const auth_dto_1 = require("../dto/auth.dto");
const jwt_1 = require("@nestjs/jwt");
let AuthController = class AuthController {
    constructor(authService, jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }
    async signinUser(loginDto) {
        return this.authService.signinUser(loginDto.auth_id, loginDto.password);
    }
    async refresh(refreshToken) {
        return this.authService.refreshToken(refreshToken);
    }
    async unlockAccount(authorization, userId) {
        if (!authorization || !authorization.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('유효하지 않은 토큰');
        }
        const token = authorization.substring(7);
        try {
            const payload = this.jwtService.verify(token);
            if (payload.role !== 'super_admin') {
                throw new common_1.UnauthorizedException('super_admin 권한이 필요합니다');
            }
            return await this.authService.unlockAccount(userId, payload.sub);
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            throw new common_1.UnauthorizedException('유효하지 않은 토큰');
        }
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('api/user/signin'),
    (0, swagger_1.ApiOperation)({ summary: '사용자 로그인' }),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.UserLoginDto }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '등록되지 않은 사용자입니다 또는 비밀번호가 일치하지 않습니다' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.UserLoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signinUser", null);
__decorate([
    (0, common_1.Post)('api/user/refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '토큰 갱신' }),
    (0, swagger_1.ApiBody)({
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
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '토큰 갱신 성공',
        schema: {
            type: 'object',
            properties: {
                access_token: { type: 'string', description: '새로운 JWT Access Token (2시간 유효)' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: '유효하지 않은 리프레시 토큰',
    }),
    __param(0, (0, common_1.Body)('refresh_token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('api/admin/unlock-account'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '계정 잠금 해제 (super_admin 전용)' }),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiBody)({
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
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패 또는 권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '사용자를 찾을 수 없음' }),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)('user_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "unlockAccount", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('인증'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        jwt_1.JwtService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map