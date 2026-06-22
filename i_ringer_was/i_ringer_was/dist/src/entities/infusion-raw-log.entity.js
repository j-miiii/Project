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
exports.InfusionRawLog = void 0;
const typeorm_1 = require("typeorm");
let InfusionRawLog = class InfusionRawLog {
};
exports.InfusionRawLog = InfusionRawLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InfusionRawLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, comment: 'iRinger 디바이스 시리얼 번호' }),
    __metadata("design:type", String)
], InfusionRawLog.prototype, "sn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, comment: 'API 구분자' }),
    __metadata("design:type", String)
], InfusionRawLog.prototype, "api", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['IR', 'LOAD_CELL'], comment: '디바이스 타입 (IR 또는 LOAD_CELL)' }),
    __metadata("design:type", String)
], InfusionRawLog.prototype, "device_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 6, scale: 2, nullable: true, comment: '무게 측정값 (소수점 2자리)' }),
    __metadata("design:type", Number)
], InfusionRawLog.prototype, "weight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', comment: '배터리 잔량' }),
    __metadata("design:type", Number)
], InfusionRawLog.prototype, "battery", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 8, scale: 2, nullable: true, comment: '주입량 (ml)' }),
    __metadata("design:type", Number)
], InfusionRawLog.prototype, "injected_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 6, scale: 2, nullable: true, comment: '방울 수 (gtt)' }),
    __metadata("design:type", Number)
], InfusionRawLog.prototype, "gtt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '측정 유속 (cc/hr)' }),
    __metadata("design:type", Number)
], InfusionRawLog.prototype, "cchr", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '남은 시간 (분)' }),
    __metadata("design:type", Number)
], InfusionRawLog.prototype, "rest_minute", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true, comment: '타임스탬프' }),
    __metadata("design:type", Number)
], InfusionRawLog.prototype, "time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true, comment: '추가 JSON 데이터' }),
    __metadata("design:type", Object)
], InfusionRawLog.prototype, "extra_json", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], InfusionRawLog.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], InfusionRawLog.prototype, "updated_at", void 0);
exports.InfusionRawLog = InfusionRawLog = __decorate([
    (0, typeorm_1.Entity)('infusion_raw_logs')
], InfusionRawLog);
//# sourceMappingURL=infusion-raw-log.entity.js.map