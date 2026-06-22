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
exports.UnifiedController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_service_1 = require("./app.service");
let UnifiedController = class UnifiedController {
    constructor(appService) {
        this.appService = appService;
    }
    async findAll(tableName, query, authorization) {
        try {
            return await this.appService.findAll(tableName, query, authorization);
        }
        catch (error) {
            throw new common_1.NotFoundException(`Table ${tableName} not found or accessible`);
        }
    }
    async findOne(tableName, id, userId, authorization) {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
            throw new common_1.NotFoundException(`Invalid ID format: ${id}`);
        }
        try {
            return await this.appService.findOne(tableName, numericId, userId);
        }
        catch (error) {
            throw new common_1.NotFoundException(`Record not found in ${tableName} with id ${id}`);
        }
    }
    async sendFcmTest(body) {
        return await this.appService.sendFcmTest(body.user_id, body.title, body.body);
    }
    async markAllNotificationsAsRead(body) {
        return await this.appService.markAllNotificationsAsRead(body.user_id);
    }
    async update(tableName, id, updateDto, req) {
        try {
            return await this.appService.update(tableName, id, updateDto);
        }
        catch (error) {
            throw error;
        }
    }
    async remove(tableName, id, req) {
        try {
            await this.appService.remove(tableName, id);
            return { message: `Record with id ${id} deleted successfully from ${tableName}` };
        }
        catch (error) {
            throw error;
        }
    }
};
exports.UnifiedController = UnifiedController;
__decorate([
    (0, common_1.Get)(':table_name'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiParam)({ name: 'table_name', example: 'users', description: '조회할 테이블 이름' }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, description: '검색 키워드' }),
    (0, swagger_1.ApiQuery)({ name: 'order', required: false, example: 'id:desc', description: '정렬 조건을 문자열 형태로 입력 (예: id:desc,created_at:asc)' }),
    (0, swagger_1.ApiQuery)({ name: 'where', required: false, example: '', description: '필터링 조건을 문자열 형태로 입력 (예: status:active,type:premium)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, example: 10, description: '페이지당 항목 수 (기본값: 10)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, example: 1, description: '페이지 번호 (기본값: 1)' }),
    (0, swagger_1.ApiQuery)({ name: 'start_date', required: false, example: '', description: '시작일 (YYYY-MM-DD 형식)' }),
    (0, swagger_1.ApiQuery)({ name: 'end_date', required: false, example: '', description: '종료일 (YYYY-MM-DD 형식)' }),
    (0, swagger_1.ApiOperation)({ summary: '데이터 목록 조회', description: '지정된 테이블의 데이터 목록을 조회합니다.' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '성공적으로 조회됨' }),
    __param(0, (0, common_1.Param)('table_name')),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], UnifiedController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':table_name/:id'),
    (0, swagger_1.ApiParam)({ name: 'table_name', example: 'users', description: '조회할 테이블 이름' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 1, description: '조회할 레코드 ID' }),
    (0, swagger_1.ApiQuery)({ name: 'user_id', required: false, description: '사용자 ID (관련 데이터 확인용)' }),
    (0, swagger_1.ApiOperation)({ summary: '데이터 상세 조회', description: '지정된 테이블의 특정 데이터를 조회합니다.' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '성공적으로 조회됨' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '데이터를 찾을 수 없음' }),
    __param(0, (0, common_1.Param)('table_name')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('user_id')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, String]),
    __metadata("design:returntype", Promise)
], UnifiedController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)('fcm/test'),
    (0, swagger_1.ApiOperation)({ summary: 'FCM 푸시 테스트', description: '특정 사용자에게 FCM 테스트 푸시를 발송합니다.' }),
    (0, swagger_1.ApiBody)({
        description: 'FCM 테스트 데이터',
        schema: {
            type: 'object',
            properties: {
                user_id: { type: 'number', description: '대상 유저 ID' },
                title: { type: 'string', description: '알림 제목', example: 'FCM 테스트' },
                body: { type: 'string', description: '알림 본문', example: '테스트 메시지입니다.' },
            },
            required: ['user_id', 'title', 'body'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'FCM 발송 결과' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UnifiedController.prototype, "sendFcmTest", null);
__decorate([
    (0, common_1.Post)('notifications/mark-all-read'),
    (0, swagger_1.ApiOperation)({ summary: '알림 전체 읽음 처리', description: '특정 사용자의 미읽은 알림을 일괄 읽음 처리합니다.' }),
    (0, swagger_1.ApiBody)({
        description: '사용자 ID',
        schema: { type: 'object', properties: { user_id: { type: 'number' } }, required: ['user_id'] }
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '성공적으로 처리됨' }),
    (0, swagger_1.ApiBearerAuth)('bearerAuth'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UnifiedController.prototype, "markAllNotificationsAsRead", null);
__decorate([
    (0, common_1.Put)(':table_name/:id'),
    (0, swagger_1.ApiParam)({ name: 'table_name', example: 'users', description: '수정할 테이블 이름' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 1, description: '수정할 레코드 ID' }),
    (0, swagger_1.ApiBody)({
        description: '수정할 데이터',
        schema: {
            type: 'object',
            example: {}
        }
    }),
    (0, swagger_1.ApiOperation)({ summary: '데이터 수정', description: '지정된 테이블의 특정 데이터를 수정합니다.' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '성공적으로 수정됨' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '데이터를 찾을 수 없음' }),
    (0, swagger_1.ApiBearerAuth)('bearerAuth'),
    __param(0, (0, common_1.Param)('table_name')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], UnifiedController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':table_name/:id'),
    (0, swagger_1.ApiParam)({ name: 'table_name', example: 'users', description: '삭제할 테이블 이름' }),
    (0, swagger_1.ApiParam)({ name: 'id', example: 1, description: '삭제할 레코드 ID' }),
    (0, swagger_1.ApiOperation)({ summary: '데이터 삭제', description: '지정된 테이블의 특정 데이터를 삭제합니다.' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '성공적으로 삭제됨' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '데이터를 찾을 수 없음' }),
    (0, swagger_1.ApiBearerAuth)('bearerAuth'),
    __param(0, (0, common_1.Param)('table_name')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", Promise)
], UnifiedController.prototype, "remove", null);
exports.UnifiedController = UnifiedController = __decorate([
    (0, common_1.Controller)('api'),
    (0, swagger_1.ApiTags)('통합'),
    __metadata("design:paramtypes", [app_service_1.AppService])
], UnifiedController);
//# sourceMappingURL=unified.controller.js.map