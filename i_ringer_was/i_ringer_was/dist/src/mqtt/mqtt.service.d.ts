import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app.service';
interface DeviceSettingData {
    totalVolume?: number;
    flowRate?: number;
    settings?: any;
    infusion_current_volume?: number;
    infusion_change_button?: boolean;
}
export declare class MqttService implements OnModuleInit, OnModuleDestroy {
    private configService;
    private appService;
    private client;
    private readonly logger;
    private readonly topics;
    private mqttEnabled;
    constructor(configService: ConfigService, appService: AppService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private connectToBroker;
    private subscribeToTopics;
    private handleMessage;
    private handleIRingerData;
    private handleIRingerEmergency;
    publishMessage(topic: string, message: any): void;
    sendDeviceSetting(deviceSn: string, settings: DeviceSettingData): void;
    subscribeToCustomTopic(topic: string, callback: (message: string) => void): void;
    unsubscribeFromTopic(topic: string): void;
    isConnected(): boolean;
}
export {};
