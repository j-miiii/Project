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
exports.UpdateInfusionDto = exports.CreateInfusionDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateInfusionDto {
}
exports.CreateInfusionDto = CreateInfusionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'NS', description: '영문 약어' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateInfusionDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '생리식염수', description: '수액명' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateInfusionDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 500, description: '기본 용량 (ml)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionDto.prototype, "default_volume", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 60, description: '기본 유속 (gtt/min)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionDto.prototype, "default_gtt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 200, description: '기본 유속 (cc/hr)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionDto.prototype, "default_cchr", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '0.9% NaCl 용액', description: '설명' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateInfusionDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '활성 여부' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateInfusionDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, description: '표시순서' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionDto.prototype, "display_order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, description: '사용횟수' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionDto.prototype, "usage_count", void 0);
class UpdateInfusionDto extends (0, swagger_1.PartialType)(CreateInfusionDto) {
}
exports.UpdateInfusionDto = UpdateInfusionDto;
//# sourceMappingURL=infusion.dto.js.map