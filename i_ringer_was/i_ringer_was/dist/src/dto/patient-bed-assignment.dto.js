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
exports.UpdatePatientBedAssignmentDto = exports.CreatePatientBedAssignmentDto = exports.BulkReleaseDto = exports.AlertCategory = exports.AlertType = exports.AssignmentStatus = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var AssignmentStatus;
(function (AssignmentStatus) {
    AssignmentStatus["PENDING"] = "pending";
    AssignmentStatus["INFUSING"] = "infusing";
    AssignmentStatus["PAUSED"] = "paused";
    AssignmentStatus["COMPLETED"] = "completed";
    AssignmentStatus["CANCELED"] = "canceled";
})(AssignmentStatus || (exports.AssignmentStatus = AssignmentStatus = {}));
var AlertType;
(function (AlertType) {
    AlertType["STOP"] = "stop";
    AlertType["DONE"] = "done";
    AlertType["FAST"] = "fast";
    AlertType["SLOW"] = "slow";
    AlertType["ALMOST_DONE"] = "almost_done";
    AlertType["DISCONNECTED"] = "disconnected";
})(AlertType || (exports.AlertType = AlertType = {}));
var AlertCategory;
(function (AlertCategory) {
    AlertCategory["CRITICAL"] = "critical";
    AlertCategory["CAUTION"] = "caution";
    AlertCategory["SYSTEM_ERROR"] = "system_error";
})(AlertCategory || (exports.AlertCategory = AlertCategory = {}));
class BulkReleaseDto {
}
exports.BulkReleaseDto = BulkReleaseDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: [1, 2, 3],
        description: '투여 완료 처리할 patient_bed_assignment ID 배열',
        type: [Number]
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1, { message: '최소 1개 이상의 ID가 필요합니다' }),
    (0, class_validator_1.IsInt)({ each: true, message: '모든 ID는 정수여야 합니다' }),
    __metadata("design:type", Array)
], BulkReleaseDto.prototype, "ids", void 0);
class CreatePatientBedAssignmentDto {
}
exports.CreatePatientBedAssignmentDto = CreatePatientBedAssignmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '환자 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreatePatientBedAssignmentDto.prototype, "patient_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '침대 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreatePatientBedAssignmentDto.prototype, "bed_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '장치 ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreatePatientBedAssignmentDto.prototype, "device_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '생리식염수', description: '수액 종류' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePatientBedAssignmentDto.prototype, "infusion_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 500, description: '총 수액량(ml)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreatePatientBedAssignmentDto.prototype, "infusion_total_volumn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 60.0, description: '처방 GTT (방울/분)', default: 60.0 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreatePatientBedAssignmentDto.prototype, "infusion_gtt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 164.10, description: '처방 CCHR (ml/hr)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreatePatientBedAssignmentDto.prototype, "infusion_cchr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2025-09-04T14:00:00Z', description: '할당 시간' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePatientBedAssignmentDto.prototype, "assigned_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '해제 시간' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePatientBedAssignmentDto.prototype, "discharged_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'pending', enum: AssignmentStatus, description: '투여 상태', default: 'pending' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(AssignmentStatus),
    __metadata("design:type", String)
], CreatePatientBedAssignmentDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '활성 여부', default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreatePatientBedAssignmentDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-13T10:00:00Z', description: '투여 시작 시간' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePatientBedAssignmentDto.prototype, "started_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, description: '투여 중지 시간' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePatientBedAssignmentDto.prototype, "stopped_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'caution', enum: AlertCategory, description: '알림 카테고리' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(AlertCategory),
    __metadata("design:type", String)
], CreatePatientBedAssignmentDto.prototype, "alert_category", void 0);
class UpdatePatientBedAssignmentDto extends (0, swagger_1.PartialType)(CreatePatientBedAssignmentDto) {
}
exports.UpdatePatientBedAssignmentDto = UpdatePatientBedAssignmentDto;
//# sourceMappingURL=patient-bed-assignment.dto.js.map