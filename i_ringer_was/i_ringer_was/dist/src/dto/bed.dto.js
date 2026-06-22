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
exports.UpdateBedDto = exports.CreateBedDto = exports.BedStatus = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var BedStatus;
(function (BedStatus) {
    BedStatus["AVAILABLE"] = "available";
    BedStatus["OCCUPIED"] = "occupied";
    BedStatus["MAINTENANCE"] = "maintenance";
})(BedStatus || (exports.BedStatus = BedStatus = {}));
class CreateBedDto {
}
exports.CreateBedDto = CreateBedDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: '병실 ID' }),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateBedDto.prototype, "room_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'A1', description: '침대 번호' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBedDto.prototype, "bed_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'available', enum: BedStatus, description: '침대 상태' }),
    (0, class_validator_1.IsEnum)(BedStatus),
    __metadata("design:type", String)
], CreateBedDto.prototype, "status", void 0);
class UpdateBedDto extends (0, swagger_1.PartialType)(CreateBedDto) {
}
exports.UpdateBedDto = UpdateBedDto;
//# sourceMappingURL=bed.dto.js.map