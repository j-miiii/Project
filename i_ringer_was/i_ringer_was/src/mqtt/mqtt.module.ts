import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import { AppModule } from '../app.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => AppModule), // AppModule을 forwardRef로 import하여 순환 참조 해결
  ],
  controllers: [MqttController],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}