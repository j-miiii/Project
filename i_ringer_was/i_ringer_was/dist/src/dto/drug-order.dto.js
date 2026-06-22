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
exports.UpdateDrugOrderDto = exports.CreateDrugOrderDto = exports.DrugOrderStatus = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var DrugOrderStatus;
(function (DrugOrderStatus) {
    DrugOrderStatus["ACTIVE"] = "active";
    DrugOrderStatus["COMPLETED"] = "completed";
    DrugOrderStatus["CANCELED"] = "canceled";
})(DrugOrderStatus || (exports.DrugOrderStatus = DrugOrderStatus = {}));
class CreateDrugOrderDto {
}
exports.CreateDrugOrderDto = CreateDrugOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '환자 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateDrugOrderDto.prototype, "patient_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '수액 종류 ID (infusions FK)' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateDrugOrderDto.prototype, "infusion_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'ORD001', description: '처방 코드' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDrugOrderDto.prototype, "order_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 500, description: '처방 용량 (ml)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateDrugOrderDto.prototype, "volume", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 60, description: '처방 유속 (gtt/min)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateDrugOrderDto.prototype, "gtt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 164.10, description: '처방 유속 (ml/hr)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateDrugOrderDto.prototype, "cchr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '20260414', description: '처방 일자 (YYYYMMDD)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDrugOrderDto.prototype, "order_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'active', enum: DrugOrderStatus, description: '처방 상태' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(DrugOrderStatus),
    __metadata("design:type", String)
], CreateDrugOrderDto.prototype, "status", void 0);
class UpdateDrugOrderDto extends (0, swagger_1.PartialType)(CreateDrugOrderDto) {
}
exports.UpdateDrugOrderDto = UpdateDrugOrderDto;
//# sourceMappingURL=drug-order.dto.js.map