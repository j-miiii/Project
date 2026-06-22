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
exports.ModelsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_service_1 = require("./app.service");
let ModelsController = class ModelsController {
    constructor(appService) {
        this.appService = appService;
    }
    async createUser(data) {
        try {
            return await this.appService.insertData('users', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createPatient(data) {
        try {
            return await this.appService.insertData('patients', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createHospital(data) {
        try {
            return await this.appService.insertData('hospitals', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createWard(data) {
        try {
            return await this.appService.insertData('wards', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createRoom(data) {
        try {
            return await this.appService.insertData('rooms', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createBed(data) {
        try {
            return await this.appService.insertData('beds', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createDevice(data) {
        try {
            return await this.appService.insertData('devices', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createPatientBedAssignment(data) {
        try {
            return await this.appService.insertData('patient_bed_assignments', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createInfusionRawLog(data) {
        try {
            return await this.appService.insertData('infusion_raw_logs', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createNotification(data) {
        try {
            return await this.appService.insertData('notifications', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createUserSetting(data) {
        try {
            return await this.appService.insertData('user_settings', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createAccessToken(data) {
        try {
            return await this.appService.insertData('access_tokens', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createInfusion(data) {
        try {
            return await this.appService.insertData('infusions', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createDrugOrder(data) {
        try {
            return await this.appService.insertData('drug_orders', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createPatientVital(data) {
        try {
            return await this.appService.insertData('patient_vitals', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createNurseRoomAssignment(data) {
        try {
            return await this.appService.insertData('nurse_room_assignments', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createTerm(data) {
        try {
            return await this.appService.insertData('terms', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createUserTermAgreement(data) {
        try {
            return await this.appService.insertData('user_term_agreements', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createInfusionEventLog(data) {
        try {
            return await this.appService.insertData('infusion_event_logs', data);
        }
        catch (error) {
            throw new common_1.HttpException(error.message || 'Internal server error', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.ModelsController = ModelsController;
__decorate([
    (0, common_1.Post)('users'),
    (0, swagger_1.ApiOperation)({ summary: '사용자 생성', description: '새로운 사용자를 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '사용자 데이터',
        schema: {
            type: 'object',
            example: {
                role: '간호사',
                auth_id: 'nurse001',
                password: 'password123',
                nickname: '김간호사',
                hospital_id: 'H001',
                ward_id: 1,
                employee_number: 'EMP001',
                profile_image: '/images/default_profile.png'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createUser", null);
__decorate([
    (0, common_1.Post)('patients'),
    (0, swagger_1.ApiOperation)({ summary: '환자 생성', description: '새로운 환자를 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '환자 데이터',
        schema: {
            type: 'object',
            example: {
                nickname: '홍길동',
                chart_number: 'P001'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createPatient", null);
__decorate([
    (0, common_1.Post)('hospitals'),
    (0, swagger_1.ApiOperation)({ summary: '병원 생성', description: '새로운 병원을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '병원 데이터',
        schema: {
            type: 'object',
            example: {
                name: '서울대학교병원'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createHospital", null);
__decorate([
    (0, common_1.Post)('wards'),
    (0, swagger_1.ApiOperation)({ summary: '병동 생성', description: '새로운 병동을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '병동 데이터',
        schema: {
            type: 'object',
            example: {
                hospital_id: 1,
                name: '내과병동'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createWard", null);
__decorate([
    (0, common_1.Post)('rooms'),
    (0, swagger_1.ApiOperation)({ summary: '병실 생성', description: '새로운 병실을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '병실 데이터',
        schema: {
            type: 'object',
            example: {
                ward_id: 1,
                name: '101호',
                bed_count: 4
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Post)('beds'),
    (0, swagger_1.ApiOperation)({ summary: '침대 생성', description: '새로운 침대를 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '침대 데이터',
        schema: {
            type: 'object',
            example: {
                room_id: 1,
                bed_number: 'A1',
                status: 'available'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createBed", null);
__decorate([
    (0, common_1.Post)('devices'),
    (0, swagger_1.ApiOperation)({ summary: '장치 생성', description: '새로운 링겔 모니터링 장치를 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '장치 데이터',
        schema: {
            type: 'object',
            example: {
                device_name: 'I-Ringer-001',
                serial_number: 'IR001',
                network_status: 'online',
                battery_percent: 85,
                firmware_version: '1.0.0',
                bed_id: '1'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createDevice", null);
__decorate([
    (0, common_1.Post)('patient_bed_assignments'),
    (0, swagger_1.ApiOperation)({ summary: '환자 침대 할당 생성', description: '환자를 침대에 할당합니다. 수액은 별도로 /api/monitoring/assignments/add-infusion 으로 추가합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '환자 침대 할당 데이터',
        schema: {
            type: 'object',
            example: {
                patient_id: 1,
                bed_id: 1,
                device_id: 1,
                assigned_at: '2025-09-04T14:00:00Z',
                status: 'pending',
                is_active: true
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createPatientBedAssignment", null);
__decorate([
    (0, common_1.Post)('infusion_raw_logs'),
    (0, swagger_1.ApiOperation)({ summary: '수액 원시 로그 생성', description: '새로운 수액 원시 로그를 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '수액 원시 로그 데이터',
        schema: {
            type: 'object',
            example: {
                sn: 'IR001',
                api: 'v1',
                device_type: 'IR',
                weight: 450.50,
                battery: 85,
                injected_amount: 50.25,
                gtt: 120.5,
                rest_minute: 45,
                time: 1725451200000,
                extra_json: { "temperature": 25, "humidity": 60 }
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createInfusionRawLog", null);
__decorate([
    (0, common_1.Post)('notifications'),
    (0, swagger_1.ApiOperation)({ summary: '알림 생성', description: '새로운 알림을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '알림 데이터',
        schema: {
            type: 'object',
            example: {
                user_id: 1,
                patient_bed_assignment_id: 1,
                device_id: 1,
                title: '수액 투여 완료 임박',
                message: '환자 홍길동의 수액 투여가 완료 임박입니다.',
                type: 'almost_done',
                is_read: 0,
                alert_category: 'caution'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createNotification", null);
__decorate([
    (0, common_1.Post)('user_settings'),
    (0, swagger_1.ApiOperation)({ summary: '사용자 설정 생성', description: '새로운 사용자 설정을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '사용자 설정 데이터',
        schema: {
            type: 'object',
            example: {
                user_id: 1,
                fast_enabled: 1,
                fast_threshold: 50,
                slow_enabled: 1,
                slow_threshold: -50,
                default_gatt: 60,
                complete_enabled: 1,
                complete_threshold: 95,
                stop_enabled: 1,
                alert_color: '#FF0000',
                alert_display_time: 5,
                critical_alert_enabled: 1,
                critical_sound_enabled: 1,
                caution_alert_enabled: 1,
                caution_sound_enabled: 1,
                system_error_alert_enabled: 1,
                system_error_sound_enabled: 1,
                volume_display_mode: 'percentage'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createUserSetting", null);
__decorate([
    (0, common_1.Post)('access_tokens'),
    (0, swagger_1.ApiOperation)({ summary: '액세스 토큰 생성', description: '새로운 액세스 토큰을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '액세스 토큰 데이터',
        schema: {
            type: 'object',
            example: {
                user_id: 1,
                access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                expires_at: '2025-09-04T15:00:00Z'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createAccessToken", null);
__decorate([
    (0, common_1.Post)('infusions'),
    (0, swagger_1.ApiOperation)({ summary: '수액 마스터 생성', description: '새로운 수액 종류를 등록합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '수액 마스터 데이터',
        schema: {
            type: 'object',
            example: {
                code: 'NS',
                name: '생리식염수',
                default_volume: 500,
                default_gtt: 60,
                description: '0.9% NaCl 용액',
                is_active: true
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createInfusion", null);
__decorate([
    (0, common_1.Post)('drug_orders'),
    (0, swagger_1.ApiOperation)({ summary: '투약 처방 생성', description: '새로운 투약 처방을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '투약 처방 데이터',
        schema: {
            type: 'object',
            example: {
                patient_id: 1,
                infusion_id: 1,
                order_code: 'ORD001',
                volume: 500,
                gtt: 60,
                order_date: '20260414',
                status: 'active'
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createDrugOrder", null);
__decorate([
    (0, common_1.Post)('patient_vitals'),
    (0, swagger_1.ApiOperation)({ summary: '환자 바이탈 생성', description: '새로운 환자 바이탈 기록을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '환자 바이탈 데이터',
        schema: {
            type: 'object',
            example: {
                patient_id: 1,
                adm: 'ADM001',
                date: '20250326',
                time: '1430',
                nurse_key: 'NK001',
                height: 170.5,
                weight: 65.0
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createPatientVital", null);
__decorate([
    (0, common_1.Post)('nurse_room_assignments'),
    (0, swagger_1.ApiOperation)({ summary: '간호사 병실 배정 생성', description: '간호사를 병실에 배정합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '간호사 병실 배정 데이터',
        schema: {
            type: 'object',
            example: {
                user_id: 1,
                room_id: 1,
                is_active: true
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createNurseRoomAssignment", null);
__decorate([
    (0, common_1.Post)('terms'),
    (0, swagger_1.ApiOperation)({ summary: '약관 생성', description: '새로운 약관을 생성합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '약관 데이터',
        schema: {
            type: 'object',
            example: {
                title: '개인정보 처리방침',
                content: '약관 내용...',
                version: '1.0',
                type: 'privacy',
                is_required: true,
                is_active: true
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createTerm", null);
__decorate([
    (0, common_1.Post)('user_term_agreements'),
    (0, swagger_1.ApiOperation)({ summary: '약관 동의 생성', description: '사용자의 약관 동의를 기록합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '약관 동의 데이터',
        schema: {
            type: 'object',
            example: {
                user_id: 1,
                term_id: 1
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createUserTermAgreement", null);
__decorate([
    (0, common_1.Post)('infusion_event_logs'),
    (0, swagger_1.ApiOperation)({ summary: '수액 이벤트 로그 생성', description: '수액 투여 이벤트 로그를 기록합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '수액 이벤트 로그 데이터',
        schema: {
            type: 'object',
            example: {
                patient_bed_assignment_id: 1,
                event_type: 'start',
                before_value: null,
                after_value: { status: 'infusing' },
                performed_by: 1
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModelsController.prototype, "createInfusionEventLog", null);
exports.ModelsController = ModelsController = __decorate([
    (0, common_1.Controller)('api'),
    (0, swagger_1.ApiTags)('개별모델 삽입'),
    __metadata("design:paramtypes", [app_service_1.AppService])
], ModelsController);
//# sourceMappingURL=models.controller.js.map