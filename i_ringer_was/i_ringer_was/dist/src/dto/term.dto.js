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
exports.UpdateTermDto = exports.CreateTermDto = exports.TermType = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var TermType;
(function (TermType) {
    TermType["PRIVACY"] = "privacy";
    TermType["SERVICE"] = "service";
    TermType["MARKETING"] = "marketing";
    TermType["LOCATION"] = "location";
})(TermType || (exports.TermType = TermType = {}));
class CreateTermDto {
}
exports.CreateTermDto = CreateTermDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '개인정보 처리방침', description: '약관 제목' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTermDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '약관 내용입니다...', description: '약관 내용' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTermDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1.0', description: '약관 버전' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTermDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'privacy', enum: TermType, description: '약관 유형' }),
    (0, class_validator_1.IsEnum)(TermType),
    __metadata("design:type", String)
], CreateTermDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '필수 동의 여부', default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateTermDto.prototype, "is_required", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '활성 여부', default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateTermDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-13T00:00:00Z', description: '시행일' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateTermDto.prototype, "effective_at", void 0);
class UpdateTermDto extends (0, swagger_1.PartialType)(CreateTermDto) {
}
exports.UpdateTermDto = UpdateTermDto;
//# sourceMappingURL=term.dto.js.map