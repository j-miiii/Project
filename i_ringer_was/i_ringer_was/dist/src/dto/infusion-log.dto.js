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
exports.UpdateInfusionLogDto = exports.CreateInfusionLogDto = exports.AlarmType = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var AlarmType;
(function (AlarmType) {
    AlarmType["NORMAL"] = "normal";
    AlarmType["FAST"] = "fast";
    AlarmType["SLOW"] = "slow";
    AlarmType["COMPLETE"] = "complete";
    AlarmType["ERROR"] = "error";
})(AlarmType || (exports.AlarmType = AlarmType = {}));
class CreateInfusionLogDto {
}
exports.CreateInfusionLogDto = CreateInfusionLogDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '장치 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionLogDto.prototype, "device_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '환자 침대 할당 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionLogDto.prototype, "patient_bed_assignment_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-09-04T14:00:00Z', description: '로그 시간' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateInfusionLogDto.prototype, "log_time", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 60.5, description: '유속(ml/h)' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateInfusionLogDto.prototype, "flow_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 250, description: '주입량(ml)' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateInfusionLogDto.prototype, "infused_volume", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'normal', enum: AlarmType, description: '알람 유형' }),
    (0, class_validator_1.IsEnum)(AlarmType),
    __metadata("design:type", String)
], CreateInfusionLogDto.prototype, "alarm_type", void 0);
class UpdateInfusionLogDto extends (0, swagger_1.PartialType)(CreateInfusionLogDto) {
}
exports.UpdateInfusionLogDto = UpdateInfusionLogDto;
//# sourceMappingURL=infusion-log.dto.js.map