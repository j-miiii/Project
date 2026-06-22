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
exports.UpdateInfusionEventLogDto = exports.CreateInfusionEventLogDto = exports.InfusionEventType = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var InfusionEventType;
(function (InfusionEventType) {
    InfusionEventType["START"] = "start";
    InfusionEventType["PAUSE"] = "pause";
    InfusionEventType["RESUME"] = "resume";
    InfusionEventType["COMPLETE"] = "complete";
    InfusionEventType["CANCEL"] = "cancel";
    InfusionEventType["ALERT"] = "alert";
    InfusionEventType["MODIFY"] = "modify";
})(InfusionEventType || (exports.InfusionEventType = InfusionEventType = {}));
class CreateInfusionEventLogDto {
}
exports.CreateInfusionEventLogDto = CreateInfusionEventLogDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '환자 침대 배정 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionEventLogDto.prototype, "patient_bed_assignment_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'start', enum: InfusionEventType, description: '이벤트 유형' }),
    (0, class_validator_1.IsEnum)(InfusionEventType),
    __metadata("design:type", String)
], CreateInfusionEventLogDto.prototype, "event_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: null, description: '변경 전 값 (JSON)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateInfusionEventLogDto.prototype, "before_value", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { status: 'infusing' }, description: '변경 후 값 (JSON)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateInfusionEventLogDto.prototype, "after_value", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, description: '수행자 (간호사 user_id)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateInfusionEventLogDto.prototype, "performed_by", void 0);
class UpdateInfusionEventLogDto extends (0, swagger_1.PartialType)(CreateInfusionEventLogDto) {
}
exports.UpdateInfusionEventLogDto = UpdateInfusionEventLogDto;
//# sourceMappingURL=infusion-event-log.dto.js.map