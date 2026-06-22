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
exports.UpdateNurseRoomAssignmentDto = exports.CreateNurseRoomAssignmentDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateNurseRoomAssignmentDto {
}
exports.CreateNurseRoomAssignmentDto = CreateNurseRoomAssignmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '간호사 user_id' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateNurseRoomAssignmentDto.prototype, "user_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '병실 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateNurseRoomAssignmentDto.prototype, "room_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: '활성 여부', default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateNurseRoomAssignmentDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-13T09:00:00Z', description: '배정 시간' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateNurseRoomAssignmentDto.prototype, "assigned_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, description: '해제 시간' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateNurseRoomAssignmentDto.prototype, "released_at", void 0);
class UpdateNurseRoomAssignmentDto extends (0, swagger_1.PartialType)(CreateNurseRoomAssignmentDto) {
}
exports.UpdateNurseRoomAssignmentDto = UpdateNurseRoomAssignmentDto;
//# sourceMappingURL=nurse-room-assignment.dto.js.map