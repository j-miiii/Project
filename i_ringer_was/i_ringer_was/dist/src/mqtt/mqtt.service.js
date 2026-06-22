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
var MqttService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mqtt = require("mqtt");
const app_service_1 = require("../app.service");
let MqttService = MqttService_1 = class MqttService {
    constructor(configService, appService) {
        this.configService = configService;
        this.appService = appService;
        this.logger = new common_1.Logger(MqttService_1.name);
        this.topics = {
            iringerData: '/iringer_data',
            iringerEmergency: '/iringer_emergency',
        };
        this.mqttEnabled = this.configService.get('MQTT_ENABLED', 'false') === 'true';
    }
    async onModuleInit() {
        if (this.mqttEnabled) {
            await this.connectToBroker();
            await this.subscribeToTopics();
        }
        else {
            this.logger.log('MQTT is disabled. Set MQTT_ENABLED=true in .env to enable MQTT functionality.');
        }
    }
    async onModuleDestroy() {
        if (this.client) {
            this.client.end();
        }
    }
    async connectToBroker() {
        const host = this.configService.get('MQTT_HOST', 'localhost');
        const port = this.configService.get('MQTT_PORT', 1883);
        const username = this.configService.get('MQTT_USERNAME');
        const password = this.configService.get('MQTT_PASSWORD');
        const options = {
            host,
            port,
            protocol: 'mqtt',
            clientId: `nestjs_server_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            clean: false,
            connectTimeout: 4000,
            reconnectPeriod: 1000,
            keepalive: 15,
            reschedulePings: true,
        };
        if (username && password) {
            options.username = username;
            options.password = password;
        }
        this.client = mqtt.connect(options);
        this.client.on('connect', () => {
            this.logger.log(`Connected to MQTT broker at ${host}:${port}`);
            this.logger.log(`Connection keepalive: ${options.keepalive}s, clientId: ${options.clientId}`);
        });
        this.client.on('error', (error) => {
            this.logger.error('MQTT connection error:', error);
        });
        this.client.on('reconnect', () => {
            this.logger.log('Attempting to reconnect to MQTT broker...');
        });
        this.client.on('close', () => {
            this.logger.warn('MQTT connection closed');
        });
        this.client.on('offline', () => {
            this.logger.warn('MQTT client went offline');
        });
        this.client.on('message', this.handleMessage.bind(this));
    }
    async subscribeToTopics() {
        Object.values(this.topics).forEach((topic) => {
            this.client.subscribe(topic, (error) => {
                if (error) {
                    this.logger.error(`Failed to subscribe to ${topic}:`, error);
                }
                else {
                    this.logger.log(`Subscribed to topic: ${topic}`);
                }
            });
        });
    }
    handleMessage(topic, payload) {
        try {
            const message = payload.toString();
            this.logger.debug(`Received message on ${topic}: ${message}`);
            if (topic === '/iringer_data') {
                this.handleIRingerData(message);
            }
            else if (topic === '/iringer_emergency') {
                this.handleIRingerEmergency(message);
            }
        }
        catch (error) {
            this.logger.error('Error handling message:', error);
        }
    }
    async handleIRingerData(message) {
        try {
            const data = JSON.parse(message);
            this.logger.log(`iRinger data received from ${data.sn}: weight=${data.weight}, battery=${data.battery}`);
            await this.appService.insertData('infusion_raw_logs', data);
        }
        catch (error) {
            this.logger.error(`Failed to parse iRinger data: ${error}`);
        }
    }
    async handleIRingerEmergency(message) {
        try {
            const data = JSON.parse(message);
            this.logger.warn(`Emergency alert from ${data.sn} (api: ${data.api || 'unknown'})`);
            const emergencyData = {
                sn: data.sn,
                device_type: data.device_type,
                api: data.api,
                battery: data.battery || 0,
                extra_json: data.extra_json,
            };
            await this.appService.insertData('infusion_raw_logs', emergencyData);
        }
        catch (error) {
            this.logger.error(`Failed to parse emergency message: ${error}`);
        }
    }
    publishMessage(topic, message) {
        if (!this.mqttEnabled || !this.client) {
            this.logger.warn('MQTT is disabled or not connected');
            return;
        }
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        this.client.publish(topic, payload, { qos: 1 }, (error) => {
            if (error) {
                this.logger.error(`Failed to publish to ${topic}:`, error);
            }
            else {
                this.logger.debug(`Published to ${topic}: ${payload}`);
            }
        });
    }
    sendDeviceSetting(deviceSn, settings) {
        const topic = `/ir_device_setting/${deviceSn}`;
        this.publishMessage(topic, settings);
        this.logger.log(`Sent device settings to ${deviceSn}`);
    }
    subscribeToCustomTopic(topic, callback) {
        if (!this.mqttEnabled || !this.client) {
            this.logger.warn('MQTT is disabled or not connected');
            return;
        }
        this.client.subscribe(topic, (error) => {
            if (error) {
                this.logger.error(`Failed to subscribe to ${topic}:`, error);
            }
            else {
                this.logger.log(`Subscribed to custom topic: ${topic}`);
            }
        });
        this.client.on('message', (receivedTopic, payload) => {
            if (receivedTopic === topic) {
                callback(payload.toString());
            }
        });
    }
    unsubscribeFromTopic(topic) {
        if (!this.mqttEnabled || !this.client) {
            this.logger.warn('MQTT is disabled or not connected');
            return;
        }
        this.client.unsubscribe(topic, (error) => {
            if (error) {
                this.logger.error(`Failed to unsubscribe from ${topic}:`, error);
            }
            else {
                this.logger.log(`Unsubscribed from topic: ${topic}`);
            }
        });
    }
    isConnected() {
        return this.mqttEnabled && this.client && this.client.connected;
    }
};
exports.MqttService = MqttService;
exports.MqttService = MqttService = MqttService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => app_service_1.AppService))),
    __metadata("design:paramtypes", [config_1.ConfigService,
        app_service_1.AppService])
], MqttService);
//# sourceMappingURL=mqtt.service.js.map