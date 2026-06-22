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
exports.UpdateDeviceDto = exports.CreateDeviceDto = exports.NetworkStatus = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var NetworkStatus;
(function (NetworkStatus) {
    NetworkStatus["ONLINE"] = "online";
    NetworkStatus["OFFLINE"] = "offline";
    NetworkStatus["ERROR"] = "error";
})(NetworkStatus || (exports.NetworkStatus = NetworkStatus = {}));
class CreateDeviceDto {
}
exports.CreateDeviceDto = CreateDeviceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'I-Ringer-001', description: '장치 이름' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeviceDto.prototype, "device_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'IR001', description: '시리얼 번호' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeviceDto.prototype, "serial_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'online', enum: NetworkStatus, description: '네트워크 상태' }),
    (0, class_validator_1.IsEnum)(NetworkStatus),
    __metadata("design:type", String)
], CreateDeviceDto.prototype, "network_status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 85, description: '배터리 잔량(%)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateDeviceDto.prototype, "battery_percent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1.0.0', description: '펌웨어 버전' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeviceDto.prototype, "firmware_version", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1', description: '침대 ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeviceDto.prototype, "bed_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 51, description: '병동 ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateDeviceDto.prototype, "ward_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 101, description: '병실 ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateDeviceDto.prototype, "room_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 21, description: '병원 ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateDeviceDto.prototype, "hospital_id", void 0);
class UpdateDeviceDto extends (0, swagger_1.PartialType)(CreateDeviceDto) {
}
exports.UpdateDeviceDto = UpdateDeviceDto;
//# sourceMappingURL=device.dto.js.map