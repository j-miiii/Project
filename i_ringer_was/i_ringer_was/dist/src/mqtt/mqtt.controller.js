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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const mqtt_service_1 = require("./mqtt.service");
class PublishMessageDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'MQTT 토픽', example: '/iringer_data' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PublishMessageDto.prototype, "topic", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '발행할 메시지',
        example: {
            sn: 'iRinger-1v14',
            device_type: 'IR',
            api: 'v1',
            weight: 0,
            injected_amount: '1.6',
            gtt: '189.9',
            rest_minute: '0',
            time: '1732637801000000',
            battery: 100,
            extra_json: '{}',
        },
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], PublishMessageDto.prototype, "message", void 0);
class DeviceSettingDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: '총 수액량 (mL)', required: false, example: 500 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], DeviceSettingDto.prototype, "totalVolume", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '처방 속도 (mL/h)', required: false, example: 100 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], DeviceSettingDto.prototype, "flowRate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '수액교체파라미터', required: false, example: 100 }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], DeviceSettingDto.prototype, "infusion_change_buttion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '누적 수액총량', required: false, example: 10 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], DeviceSettingDto.prototype, "infusion_current_volume", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '추가 설정 값', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], DeviceSettingDto.prototype, "settings", void 0);
let MqttController = class MqttController {
    constructor(mqttService) {
        this.mqttService = mqttService;
    }
    getConnectionStatus() {
        return {
            connected: this.mqttService.isConnected(),
            timestamp: new Date(),
        };
    }
    publishMessageGet(topic, msg) {
        const decodedTopic = decodeURIComponent(topic);
        const decodedMsg = decodeURIComponent(msg);
        this.mqttService.publishMessage(decodedTopic, decodedMsg);
        return {
            success: true,
            topic: decodedTopic,
            message: decodedMsg,
            timestamp: new Date(),
        };
    }
    publishMessage(dto) {
        this.mqttService.publishMessage(dto.topic, dto.message);
        return {
            success: true,
            topic: dto.topic,
            timestamp: new Date(),
        };
    }
    sendDeviceSetting(deviceSn, dto) {
        this.mqttService.sendDeviceSetting(deviceSn, dto);
        return {
            success: true,
            deviceSn,
            settings: dto,
            timestamp: new Date(),
        };
    }
};
exports.MqttController = MqttController;
__decorate([
    (0, common_1.Get)('api/mqtt/status/check'),
    (0, swagger_1.ApiOperation)({ summary: 'MQTT 브로커 연결 상태 확인' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '연결 상태 반환' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MqttController.prototype, "getConnectionStatus", null);
__decorate([
    (0, common_1.Get)('api/mqtt/publish/:topic/:msg'),
    (0, swagger_1.ApiOperation)({ summary: 'GET 방식으로 MQTT 메시지 발행 (간편 테스트용)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '메시지 발행 성공' }),
    __param(0, (0, common_1.Param)('topic')),
    __param(1, (0, common_1.Param)('msg')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MqttController.prototype, "publishMessageGet", null);
__decorate([
    (0, common_1.Post)('api/mqtt/publish'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '특정 토픽에 메시지 발행' }),
    (0, swagger_1.ApiBody)({ type: PublishMessageDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '메시지 발행 성공' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PublishMessageDto]),
    __metadata("design:returntype", void 0)
], MqttController.prototype, "publishMessage", null);
__decorate([
    (0, common_1.Post)('api/mqtt/device-setting/:deviceSn'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'iRinger 기기에 설정 전송 (총 수액량, 처방속도 등)' }),
    (0, swagger_1.ApiBody)({ type: DeviceSettingDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '설정 전송 성공' }),
    __param(0, (0, common_1.Param)('deviceSn')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DeviceSettingDto]),
    __metadata("design:returntype", void 0)
], MqttController.prototype, "sendDeviceSetting", null);
exports.MqttController = MqttController = __decorate([
    (0, swagger_1.ApiTags)('MQTT'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [mqtt_service_1.MqttService])
], MqttController);
//# sourceMappingURL=mqtt.controller.js.map