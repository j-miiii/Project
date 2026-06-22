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
exports.UpdateAccessTokenDto = exports.CreateAccessTokenDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateAccessTokenDto {
}
exports.CreateAccessTokenDto = CreateAccessTokenDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '사용자 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateAccessTokenDto.prototype, "user_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: '액세스 토큰' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAccessTokenDto.prototype, "access_token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: '리프레시 토큰' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAccessTokenDto.prototype, "refresh_token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-09-04T15:00:00Z', description: '만료 시간' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateAccessTokenDto.prototype, "expires_at", void 0);
class UpdateAccessTokenDto extends (0, swagger_1.PartialType)(CreateAccessTokenDto) {
}
exports.UpdateAccessTokenDto = UpdateAccessTokenDto;
//# sourceMappingURL=access-token.dto.js.map