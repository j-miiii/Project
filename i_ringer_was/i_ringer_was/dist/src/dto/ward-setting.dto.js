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
exports.UpdateWardSettingDto = exports.CreateWardSettingDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateWardSettingDto {
}
exports.CreateWardSettingDto = CreateWardSettingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '병동 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "ward_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '빠른 주입 알림 활성화 (0/1)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "fast_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50, description: '빠른 주입 임계값(%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "fast_threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '느린 주입 알림 활성화 (0/1)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "slow_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50, description: '느린 주입 임계값(%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "slow_threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '완료 알림 활성화 (0/1)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "complete_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 95, description: '완료 알림 임계값(%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "complete_threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '중단 알림 활성화 (0/1)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "stop_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 60, description: '기본 유속(gtt)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "default_gatt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 164.10, description: '기본 유속(ml/hr)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateWardSettingDto.prototype, "default_cchr", void 0);
class UpdateWardSettingDto extends (0, swagger_1.PartialType)(CreateWardSettingDto) {
}
exports.UpdateWardSettingDto = UpdateWardSettingDto;
//# sourceMappingURL=ward-setting.dto.js.map