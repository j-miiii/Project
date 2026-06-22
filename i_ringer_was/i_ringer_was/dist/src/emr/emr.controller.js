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
exports.EmrController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_1 = require("@nestjs/jwt");
const emr_service_1 = require("./emr.service");
let EmrController = class EmrController {
    constructor(emrService, jwtService) {
        this.emrService = emrService;
        this.jwtService = jwtService;
    }
    extractUserId(authorization) {
        if (!authorization || !authorization.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('유효하지 않은 토큰');
        }
        const token = authorization.substring(7);
        try {
            const payload = this.jwtService.verify(token);
            return payload.sub;
        }
        catch {
            throw new common_1.UnauthorizedException('유효하지 않은 토큰');
        }
    }
    async getMyWard(authorization) {
        const userId = this.extractUserId(authorization);
        return await this.emrService.getMyWard(userId);
    }
    async getPatientOrders(authorization, id, dcYn, orderDate) {
        this.extractUserId(authorization);
        return await this.emrService.getPatientOrders(Number(id), {
            dc_yn: dcYn,
            order_date: orderDate,
        });
    }
    async getPatientVitals(authorization, id) {
        this.extractUserId(authorization);
        return await this.emrService.getPatientVitals(Number(id));
    }
};
exports.EmrController = EmrController;
__decorate([
    (0, common_1.Get)('api/emr/wards/my'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: '내 병동 환자 조회',
        description: 'JWT 토큰의 사용자 정보로 배정된 병동의 환자 목록을 조회합니다. 환자 EMR 정보(성별, 나이, 진료과, 담당의 등)와 투약, 디바이스 정보를 포함합니다.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '병동 환자 조회 성공',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                data: {
                    type: 'object',
                    properties: {
                        ward: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', example: 1 },
                                name: { type: 'string', example: '내과 1병동' },
                                code: { type: 'string', example: 'W01' },
                            },
                        },
                        rooms: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    room_id: { type: 'number', example: 1 },
                                    room_name: { type: 'string', example: '101' },
                                    beds: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                bed_id: { type: 'number', example: 1 },
                                                bed_number: { type: 'string', example: 'A1' },
                                                bed_status: { type: 'string', example: 'occupied' },
                                                patient: {
                                                    type: 'object',
                                                    properties: {
                                                        id: { type: 'number' },
                                                        name: { type: 'string' },
                                                        chart_number: { type: 'string' },
                                                        sex: { type: 'string' },
                                                        age: { type: 'number' },
                                                        dept: { type: 'string' },
                                                        doc: { type: 'string' },
                                                        resident: { type: 'string' },
                                                        pa_nurse: { type: 'string' },
                                                        adm: { type: 'string' },
                                                    },
                                                },
                                                assignment: {
                                                    type: 'object',
                                                    properties: {
                                                        id: { type: 'number' },
                                                        infusion_type: { type: 'string' },
                                                        total_volume: { type: 'number' },
                                                        current_volume: { type: 'number' },
                                                        infusion_gtt: { type: 'number' },
                                                        infusion_percentage: { type: 'number' },
                                                        alert_type: { type: 'string' },
                                                        assigned_at: { type: 'string' },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmrController.prototype, "getMyWard", null);
__decorate([
    (0, common_1.Get)('api/emr/patients/:id/orders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: '환자 투약 목록 조회',
        description: '환자 ID로 투약 처방 목록을 조회합니다. dc_yn, order_date 필터를 지원합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '환자 ID', example: 1, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'dc_yn', required: false, description: '처방취소여부 (Y/N)', example: 'N' }),
    (0, swagger_1.ApiQuery)({ name: 'order_date', required: false, description: '처방일자 (YYYYMMDD)', example: '20250326' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '투약 목록 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('dc_yn')),
    __param(3, (0, common_1.Query)('order_date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String, String]),
    __metadata("design:returntype", Promise)
], EmrController.prototype, "getPatientOrders", null);
__decorate([
    (0, common_1.Get)('api/emr/patients/:id/vitals'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: '환자 바이탈 조회',
        description: '환자 ID로 바이탈(신장, 체중 등) 기록을 조회합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '환자 ID', example: 1, type: Number }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '바이탈 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], EmrController.prototype, "getPatientVitals", null);
exports.EmrController = EmrController = __decorate([
    (0, swagger_1.ApiTags)('EMR'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [emr_service_1.EmrService,
        jwt_1.JwtService])
], EmrController);
//# sourceMappingURL=emr.controller.js.map