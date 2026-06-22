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
exports.UpdateUserTermAgreementDto = exports.CreateUserTermAgreementDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateUserTermAgreementDto {
}
exports.CreateUserTermAgreementDto = CreateUserTermAgreementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '사용자 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserTermAgreementDto.prototype, "user_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '약관 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateUserTermAgreementDto.prototype, "term_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-13T10:00:00Z', description: '동의 시간' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateUserTermAgreementDto.prototype, "agreed_at", void 0);
class UpdateUserTermAgreementDto extends (0, swagger_1.PartialType)(CreateUserTermAgreementDto) {
}
exports.UpdateUserTermAgreementDto = UpdateUserTermAgreementDto;
//# sourceMappingURL=user-term-agreement.dto.js.map