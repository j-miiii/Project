import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { AppService } from '../app.service';

interface IRingerData {
  sn: string;                    // 기기 식별 정보 (serial number)
  device_type: 'IR' | 'LOAD_CELL';  // 디바이스 타입
  api?: string;                  // API 버전 (v1, v2 등)
  weight?: number;               // 수액 무게
  injected_amount?: number;      // 주입량 (ml)
  gtt?: number;                  // 방울 수
  cchr?: number;                 // ml/hr 유속
  rest_minute?: number;          // 남은 시간 (분)
  time?: number;                 // Unix time (마이크로초 단위 uint64_t)
  extra_json?: any;              // 추가 JSON 데이터
  battery: number;               // 배터리 값
}

interface IRingerEmergency {
  sn: string;                    // 기기 식별 정보
  device_type: 'IR' | 'LOAD_CELL';  // 디바이스 타입
  api?: string;                  // API 버전 (v4)
  battery?: number;              // 배터리 값
  extra_json?: any;              // 추가 JSON 데이터
}

interface DeviceSettingData {
  totalVolume?: number;    // 총 수액량
  flowRate?: number;       // 처방 속도 : flowRate 이름으로 처방 속도 전달
  settings?: any;          // 추가 설정 값
   // 수액 교체 시 누적 투입량 변경ㅇ
  infusion_current_volume?: number;

  // 수액 교체 여부 파라미터
  infusion_change_button?: boolean; 
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private readonly logger = new Logger(MqttService.name);
  private readonly topics = {
    iringerData: '/iringer_data',           // 디바이스 → 서버: 수액 무061게, 배터리 데이터
    iringerEmergency: '/iringer_emergency', // 디바이스 → 서버: 긴급 메시지
  };
  private mqttEnabled: boolean;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => AppService))
    private appService: AppService,
  ) {
    this.mqttEnabled = this.configService.get<string>('MQTT_ENABLED', 'false') === 'true';
  }

  /**
   * NestJS 모듈 초기화 시 호출되는 함수
   * MQTT 브로커 연결 및 토픽 구독을 시작
   */
  async onModuleInit() {
    if (this.mqttEnabled) {
      await this.connectToBroker();
      await this.subscribeToTopics();
    } else {
      this.logger.log('MQTT is disabled. Set MQTT_ENABLED=true in .env to enable MQTT functionality.');
    }
  }

  /**
   * NestJS 모듈 종료 시 호출되는 함수
   * MQTT 클라이언트 연결을 종료
   */
  async onModuleDestroy() {
    if (this.client) {
      this.client.end();
    }
  }

  /**
   * MQTT 브로커에 연결하고 이벤트 핸들러를 설정
   */
  private async connectToBroker() {
    const host = this.configService.get<string>('MQTT_HOST', 'localhost');
    const port = this.configService.get<number>('MQTT_PORT', 1883);
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');

    const options: mqtt.IClientOptions = {
      host,
      port,
      protocol: 'mqtt',
      clientId: `nestjs_server_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      clean: false,               // 세션 유지 (재연결 시 구독 정보 보존)
      connectTimeout: 4000,
      reconnectPeriod: 1000,
      keepalive: 15,              // Keep-alive 주기 (초) - 15초마다 ping 전송하여 AWS timeout 방지
      reschedulePings: true,      // ping 재스케줄링 활성화
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

    // 패킷 송수신 모니터링 (디버깅용)
    // this.client.on('packetsend', () => {
    //   this.logger.debug('MQTT packet sent (keepalive ping)');
    // });

    // this.client.on('packetreceive', () => {
    //   this.logger.debug('MQTT packet received');
    // });

    this.client.on('message', this.handleMessage.bind(this));
  }

  /**
   * 정의된 모든 MQTT 토픽에 구독 요청
   */
  private async subscribeToTopics() {
    Object.values(this.topics).forEach((topic) => {
      this.client.subscribe(topic, (error) => {
        if (error) {
          this.logger.error(`Failed to subscribe to ${topic}:`, error);
        } else {
          this.logger.log(`Subscribed to topic: ${topic}`);
        }
      });
    });
  }

  /**
   * MQTT 메시지 수신 시 호출되는 핸들러
   * 토픽에 따라 적절한 처리 함수로 라우팅
   */
  private handleMessage(topic: string, payload: Buffer) {
    try {
      const message = payload.toString();
      this.logger.debug(`Received message on ${topic}: ${message}`);

      if (topic === '/iringer_data') {
        this.handleIRingerData(message);
      } else if (topic === '/iringer_emergency') {
        this.handleIRingerEmergency(message);
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
    }
  }

  /**
   * /iringer_data 토픽에서 수신한 수액 데이터를 처리
   * 무게, 배터리 정보를 파싱하고 데이터베이스에 저장
   */
  private async handleIRingerData(message: string) {    // 기기에서 받은 데이터를 처리할 때 사용.
    try {
      const data = JSON.parse(message) as IRingerData;
      this.logger.log(`iRinger data received from ${data.sn}: weight=${data.weight}, battery=${data.battery}`);

      // AppService를 통해 DB 저장 + 후처리
      await this.appService.insertData('infusion_raw_logs', data);

    } catch (error) {
      this.logger.error(`Failed to parse iRinger data: ${error}`);
    }
  }

  /**
   * /iringer_emergency 토픽에서 수신한 긴급 알림 처리
   */
  private async handleIRingerEmergency(message: string) {
    try {
      const data = JSON.parse(message) as IRingerEmergency;
      this.logger.warn(`Emergency alert from ${data.sn} (api: ${data.api || 'unknown'})`);

      // emergency 데이터를 IRingerData 형식으로 변환
      const emergencyData: IRingerData = {
        sn: data.sn,
        device_type: data.device_type,
        api: data.api,
        battery: data.battery || 0,
        extra_json: data.extra_json,
      };

      // AppService를 통해 DB 저장 + 후처리
      await this.appService.insertData('infusion_raw_logs', emergencyData);

    } catch (error) {
      this.logger.error(`Failed to parse emergency message: ${error}`);
    }
  }

  /**
   * 지정한 토픽으로 MQTT 메시지를 발행
   */
  public publishMessage(topic: string, message: any) {
    if (!this.mqttEnabled || !this.client) {
      this.logger.warn('MQTT is disabled or not connected');
      return;
    }
    
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    this.client.publish(topic, payload, { qos: 1 }, (error) => {
      if (error) {
        this.logger.error(`Failed to publish to ${topic}:`, error);
      } else {
        this.logger.debug(`Published to ${topic}: ${payload}`);
      }
    });
  }

  /**
   * 특정 디바이스에 설정 값을 전송
   * 총 수액량, 처방 속도 등을 디바이스로 전달
   */
  public sendDeviceSetting(deviceSn: string, settings: DeviceSettingData) {
    const topic = `/ir_device_setting/${deviceSn}`;   // 특정 기기만 메시지를 받을 수 있도록 토픽을 보냄
    this.publishMessage(topic, settings);
    this.logger.log(`Sent device settings to ${deviceSn}`);
  }

  /**
   * 사용자 정의 토픽을 구독하고 콜백 함수를 등록
   */
  public subscribeToCustomTopic(topic: string, callback: (message: string) => void) {
    if (!this.mqttEnabled || !this.client) {
      this.logger.warn('MQTT is disabled or not connected');
      return;
    }
    
    this.client.subscribe(topic, (error) => {
      if (error) {
        this.logger.error(`Failed to subscribe to ${topic}:`, error);
      } else {
        this.logger.log(`Subscribed to custom topic: ${topic}`);
      }
    });

    this.client.on('message', (receivedTopic, payload) => {
      if (receivedTopic === topic) {
        callback(payload.toString());
      }
    });
  }

  /**
   * 지정한 토픽 구독을 해제
   */
  public unsubscribeFromTopic(topic: string) {
    if (!this.mqttEnabled || !this.client) {
      this.logger.warn('MQTT is disabled or not connected');
      return;
    }
    
    this.client.unsubscribe(topic, (error) => {
      if (error) {
        this.logger.error(`Failed to unsubscribe from ${topic}:`, error);
      } else {
        this.logger.log(`Unsubscribed from topic: ${topic}`);
      }
    });
  }

  /**
   * MQTT 브로커 연결 상태를 확인
   */
  public isConnected(): boolean {
    return this.mqttEnabled && this.client && this.client.connected;
  }
}