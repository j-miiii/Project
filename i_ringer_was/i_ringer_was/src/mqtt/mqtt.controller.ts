import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { MqttService } from './mqtt.service';

class PublishMessageDto {
  @ApiProperty({ description: 'MQTT 토픽', example: '/iringer_data' })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({
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
  })
  @IsOptional()
  message: any;
}

class DeviceSettingDto {
  @ApiProperty({ description: '총 수액량 (mL)', required: false, example: 500 })
  @IsNumber()
  @IsOptional()
  totalVolume?: number;    // 총 수액량

  @ApiProperty({ description: '처방 속도 (mL/h)', required: false, example: 100 })
  @IsNumber()
  @IsOptional()
  flowRate?: number;       // 처방 속도

  @ApiProperty({ description: '추가 설정 값', required: false })
  @IsOptional()
  settings?: any;          // 추가 설정 값
}

@ApiTags('MQTT')
@Controller()
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Get('api/mqtt/status/check')
  @ApiOperation({ summary: 'MQTT 브로커 연결 상태 확인' })
  @ApiResponse({ status: 200, description: '연결 상태 반환' })
  getConnectionStatus() {
    return {
      connected: this.mqttService.isConnected(),
      timestamp: new Date(),
    };
  }

  @Get('api/mqtt/publish/:topic/:msg')
  @ApiOperation({ summary: 'GET 방식으로 MQTT 메시지 발행 (간편 테스트용)' })
  @ApiResponse({ status: 200, description: '메시지 발행 성공' })
  publishMessageGet(
    @Param('topic') topic: string,
    @Param('msg') msg: string,
  ) {
    // URL 디코딩
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

  @Post('api/mqtt/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '특정 토픽에 메시지 발행' })
  @ApiBody({ type: PublishMessageDto })
  @ApiResponse({ status: 200, description: '메시지 발행 성공' })
  publishMessage(@Body() dto: PublishMessageDto) {
    this.mqttService.publishMessage(dto.topic, dto.message);
    return {
      success: true,
      topic: dto.topic,
      timestamp: new Date(),
    };
  }

  @Post('api/mqtt/device-setting/:deviceSn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'iRinger 기기에 설정 전송 (총 수액량, 처방속도 등)' })
  @ApiBody({ type: DeviceSettingDto })
  @ApiResponse({ status: 200, description: '설정 전송 성공' })
  sendDeviceSetting(
    @Param('deviceSn') deviceSn: string,
    @Body() dto: DeviceSettingDto,
  ) {
    this.mqttService.sendDeviceSetting(deviceSn, dto);
    return {
      success: true,
      deviceSn,
      settings: dto,
      timestamp: new Date(),
    };
  }
}