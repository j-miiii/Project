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
exports.UpdateUserSettingDto = exports.CreateUserSettingDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateUserSettingDto {
}
exports.CreateUserSettingDto = CreateUserSettingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '사용자 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "user_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '빠른 주입 알림 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserSettingDto.prototype, "fast_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50, description: '빠른 주입 임계값(%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "fast_threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '느린 주입 알림 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserSettingDto.prototype, "slow_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: -50, description: '느린 주입 임계값(%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "slow_threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 60, description: '기본 유속(ml/h)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "default_gatt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 164.10, description: '기본 유속 CCHR (ml/hr)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "default_cchr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '완료 알림 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserSettingDto.prototype, "complete_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 95, description: '완료 알림 임계값(%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "complete_threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '중단 알림 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateUserSettingDto.prototype, "stop_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '#FF0000', description: '알림 색상' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserSettingDto.prototype, "alert_color", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 5, description: '알림 표시 시간(초)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "alert_display_time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '위급 알림 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "critical_alert_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '위급 소리 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "critical_sound_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 100, description: '위급 소리 볼륨 (0~100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "critical_sound_volume", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '주의 알림 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "caution_alert_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '주의 소리 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "caution_sound_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 100, description: '주의 소리 볼륨 (0~100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "caution_sound_volume", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '시스템오류 알림 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "system_error_alert_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '시스템오류 소리 활성화' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "system_error_sound_enabled", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 100, description: '시스템오류 소리 볼륨 (0~100)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserSettingDto.prototype, "system_error_sound_volume", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'percentage', description: "수액량 표시 모드 ('percentage' / 'ml')" }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserSettingDto.prototype, "volume_display_mode", void 0);
class UpdateUserSettingDto extends (0, swagger_1.PartialType)(CreateUserSettingDto) {
}
exports.UpdateUserSettingDto = UpdateUserSettingDto;
//# sourceMappingURL=user-setting.dto.js.map