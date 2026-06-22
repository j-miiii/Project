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
exports.StatisticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const statistics_service_1 = require("./statistics.service");
let StatisticsController = class StatisticsController {
    constructor(statisticsService) {
        this.statisticsService = statisticsService;
    }
    async getAllDashboard(start_date, end_date, hospital_id, ward_id, room_id, granularity = 'daily') {
        if (!start_date || !end_date) {
            throw new common_1.HttpException('start_date and end_date are required', common_1.HttpStatus.BAD_REQUEST);
        }
        const validGranularities = ['daily', 'weekly', 'monthly', 'yearly'];
        if (!validGranularities.includes(granularity)) {
            throw new common_1.HttpException(`Invalid granularity. Must be one of: ${validGranularities.join(', ')}`, common_1.HttpStatus.BAD_REQUEST);
        }
        const query = {
            start_date,
            end_date,
            hospital_id: hospital_id ? parseInt(hospital_id) : undefined,
            ward_id: ward_id ? parseInt(ward_id) : undefined,
            room_id: room_id ? parseInt(room_id) : undefined,
            granularity: granularity,
        };
        return await this.statisticsService.getAllDashboardStatistics(query);
    }
    async getDeviceUsageDebug(device_id, start_date, end_date) {
        return await this.statisticsService.getDeviceUsageDebug(parseInt(device_id), start_date, end_date);
    }
};
exports.StatisticsController = StatisticsController;
__decorate([
    (0, common_1.Get)('all/dashboard'),
    (0, swagger_1.ApiQuery)({ name: 'start_date', required: true, example: '2025-10-20', description: '시작 날짜 (YYYY-MM-DD)' }),
    (0, swagger_1.ApiQuery)({ name: 'end_date', required: true, example: '2025-10-27', description: '종료 날짜 (YYYY-MM-DD)' }),
    (0, swagger_1.ApiQuery)({ name: 'hospital_id', required: false, example: '21', description: '병원 ID (선택, 없으면 전체 병원 집계)' }),
    (0, swagger_1.ApiQuery)({ name: 'ward_id', required: false, example: '51', description: '병동 ID (선택)' }),
    (0, swagger_1.ApiQuery)({ name: 'room_id', required: false, example: '101', description: '병실 ID (선택)' }),
    (0, swagger_1.ApiQuery)({ name: 'granularity', required: false, example: 'daily', description: '집계 기준 (daily, weekly, monthly, yearly)', enum: ['daily', 'weekly', 'monthly', 'yearly'] }),
    __param(0, (0, common_1.Query)('start_date')),
    __param(1, (0, common_1.Query)('end_date')),
    __param(2, (0, common_1.Query)('hospital_id')),
    __param(3, (0, common_1.Query)('ward_id')),
    __param(4, (0, common_1.Query)('room_id')),
    __param(5, (0, common_1.Query)('granularity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], StatisticsController.prototype, "getAllDashboard", null);
__decorate([
    (0, common_1.Get)('debug/device-usage'),
    (0, swagger_1.ApiQuery)({ name: 'device_id', required: true, example: '81' }),
    (0, swagger_1.ApiQuery)({ name: 'start_date', required: true, example: '2025-10-20' }),
    (0, swagger_1.ApiQuery)({ name: 'end_date', required: true, example: '2025-10-27' }),
    __param(0, (0, common_1.Query)('device_id')),
    __param(1, (0, common_1.Query)('start_date')),
    __param(2, (0, common_1.Query)('end_date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], StatisticsController.prototype, "getDeviceUsageDebug", null);
exports.StatisticsController = StatisticsController = __decorate([
    (0, swagger_1.ApiTags)('통계'),
    (0, common_1.Controller)('api/statistics'),
    __metadata("design:paramtypes", [statistics_service_1.StatisticsService])
], StatisticsController);
//# sourceMappingURL=statistics.controller.js.map