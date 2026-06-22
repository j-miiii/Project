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
exports.UpdateNotificationDto = exports.CreateNotificationDto = exports.NotificationAlertCategory = exports.NotificationType = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var NotificationType;
(function (NotificationType) {
    NotificationType["SLOW"] = "slow";
    NotificationType["FAST"] = "fast";
    NotificationType["ALMOST_DONE"] = "almost_done";
    NotificationType["STOP"] = "stop";
    NotificationType["DONE"] = "done";
    NotificationType["DISCONNECTED"] = "disconnected";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationAlertCategory;
(function (NotificationAlertCategory) {
    NotificationAlertCategory["CRITICAL"] = "critical";
    NotificationAlertCategory["CAUTION"] = "caution";
    NotificationAlertCategory["SYSTEM_ERROR"] = "system_error";
})(NotificationAlertCategory || (exports.NotificationAlertCategory = NotificationAlertCategory = {}));
class CreateNotificationDto {
}
exports.CreateNotificationDto = CreateNotificationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '사용자 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateNotificationDto.prototype, "user_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '환자 침대 할당 ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateNotificationDto.prototype, "patient_bed_assignment_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '장치 ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateNotificationDto.prototype, "device_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '수액 주입 완료', description: '알림 제목' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '환자 홍길동의 수액 주입이 완료되었습니다.', description: '알림 메시지' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'almost_done', enum: NotificationType, description: '알림 유형' }),
    (0, class_validator_1.IsEnum)(NotificationType),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false, description: '읽음 여부' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateNotificationDto.prototype, "is_read", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'caution', enum: NotificationAlertCategory, description: '알림 카테고리' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(NotificationAlertCategory),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "alert_category", void 0);
class UpdateNotificationDto extends (0, swagger_1.PartialType)(CreateNotificationDto) {
}
exports.UpdateNotificationDto = UpdateNotificationDto;
//# sourceMappingURL=notification.dto.js.map