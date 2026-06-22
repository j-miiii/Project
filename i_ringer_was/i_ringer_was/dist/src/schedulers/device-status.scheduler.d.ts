import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { MqttService } from '../mqtt/mqtt.service';
export declare class DeviceStatusScheduler {
    private readonly dataSource;
    private readonly mqttService;
    private readonly configService;
    private readonly logger;
    private readonly timeoutSeconds;
    constructor(dataSource: DataSource, mqttService: MqttService, configService: ConfigService);
    checkDeviceStatus(): Promise<void>;
    checkInfusionDataTimeout(): Promise<void>;
    private checkDeviceStatusWithRetry;
    private checkInfusionDataTimeoutWithRetry;
    updateMissingInfusionCchr(): Promise<void>;
    private updateMissingInfusionCchrWithRetry;
}
