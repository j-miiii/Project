import { MqttService } from './mqtt.service';
declare class PublishMessageDto {
    topic: string;
    message: any;
}
declare class DeviceSettingDto {
    totalVolume?: number;
    flowRate?: number;
    infusion_change_buttion?: boolean;
    infusion_current_volume?: number;
    settings?: any;
}
export declare class MqttController {
    private readonly mqttService;
    constructor(mqttService: MqttService);
    getConnectionStatus(): {
        connected: boolean;
        timestamp: Date;
    };
    publishMessageGet(topic: string, msg: string): {
        success: boolean;
        topic: string;
        message: string;
        timestamp: Date;
    };
    publishMessage(dto: PublishMessageDto): {
        success: boolean;
        topic: string;
        timestamp: Date;
    };
    sendDeviceSetting(deviceSn: string, dto: DeviceSettingDto): {
        success: boolean;
        deviceSn: string;
        settings: DeviceSettingDto;
        timestamp: Date;
    };
}
export {};
