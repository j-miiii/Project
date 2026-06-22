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
exports.UpdateWardDto = exports.CreateWardDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateWardDto {
}
exports.CreateWardDto = CreateWardDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '병원 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateWardDto.prototype, "hospital_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '내과병동', description: '병동 이름' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWardDto.prototype, "name", void 0);
class UpdateWardDto extends (0, swagger_1.PartialType)(CreateWardDto) {
}
exports.UpdateWardDto = UpdateWardDto;
//# sourceMappingURL=ward.dto.js.map