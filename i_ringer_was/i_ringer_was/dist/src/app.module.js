"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
if (typeof globalThis.crypto === 'undefined') {
    const crypto = require('crypto');
    globalThis.crypto = crypto.webcrypto || crypto;
}
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_1 = require("@nestjs/schedule");
const unified_controller_1 = require("./unified.controller");
const models_controller_1 = require("./models.controller");
const app_service_1 = require("./app.service");
const user_entity_1 = require("./entities/user.entity");
const patient_entity_1 = require("./entities/patient.entity");
const hospital_entity_1 = require("./entities/hospital.entity");
const ward_entity_1 = require("./entities/ward.entity");
const room_entity_1 = require("./entities/room.entity");
const bed_entity_1 = require("./entities/bed.entity");
const device_entity_1 = require("./entities/device.entity");
const patient_bed_assignment_entity_1 = require("./entities/patient-bed-assignment.entity");
const infusion_raw_log_entity_1 = require("./entities/infusion-raw-log.entity");
const notification_entity_1 = require("./entities/notification.entity");
const user_setting_entity_1 = require("./entities/user-setting.entity");
const access_token_entity_1 = require("./entities/access-token.entity");
const user_lockout_status_entity_1 = require("./entities/user-lockout-status.entity");
const user_lockout_log_entity_1 = require("./entities/user-lockout-log.entity");
const patient_vital_entity_1 = require("./entities/patient-vital.entity");
const drug_order_entity_1 = require("./entities/drug-order.entity");
const infusion_entity_1 = require("./entities/infusion.entity");
const nurse_room_assignment_entity_1 = require("./entities/nurse-room-assignment.entity");
const term_entity_1 = require("./entities/term.entity");
const user_term_agreement_entity_1 = require("./entities/user-term-agreement.entity");
const infusion_event_log_entity_1 = require("./entities/infusion-event-log.entity");
const ward_setting_entity_1 = require("./entities/ward-setting.entity");
const app_controller_1 = require("./app.controller");
const auth_module_1 = require("./auth/auth.module");
const mqtt_module_1 = require("./mqtt/mqtt.module");
const monitoring_module_1 = require("./monitoring/monitoring.module");
const statistics_module_1 = require("./statistics/statistics.module");
const emr_module_1 = require("./emr/emr.module");
const device_status_scheduler_1 = require("./schedulers/device-status.scheduler");
const fcm_module_1 = require("./fcm/fcm.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
            }),
            schedule_1.ScheduleModule.forRoot(),
            auth_module_1.AuthModule,
            mqtt_module_1.MqttModule,
            statistics_module_1.StatisticsModule,
            emr_module_1.EmrModule,
            fcm_module_1.FcmModule,
            (0, common_1.forwardRef)(() => monitoring_module_1.MonitoringModule),
            typeorm_1.TypeOrmModule.forRootAsync({
                name: 'default',
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: async (configService) => ({
                    type: 'mysql',
                    host: configService.get('DB_HOST'),
                    port: configService.get('DB_PORT'),
                    username: configService.get('DB_USERNAME'),
                    password: configService.get('DB_PASSWORD'),
                    database: configService.get('DB_DATABASE'),
                    entities: [
                        user_entity_1.User,
                        patient_entity_1.Patient,
                        hospital_entity_1.Hospital,
                        ward_entity_1.Ward,
                        room_entity_1.Room,
                        bed_entity_1.Bed,
                        device_entity_1.Device,
                        patient_bed_assignment_entity_1.PatientBedAssignment,
                        infusion_raw_log_entity_1.InfusionRawLog,
                        notification_entity_1.Notification,
                        user_setting_entity_1.UserSetting,
                        access_token_entity_1.AccessToken,
                        user_lockout_status_entity_1.UserLockoutStatus,
                        user_lockout_log_entity_1.UserLockoutLog,
                        patient_vital_entity_1.PatientVital,
                        drug_order_entity_1.DrugOrder,
                        infusion_entity_1.Infusion,
                        nurse_room_assignment_entity_1.NurseRoomAssignment,
                        term_entity_1.Term,
                        user_term_agreement_entity_1.UserTermAgreement,
                        infusion_event_log_entity_1.InfusionEventLog,
                        ward_setting_entity_1.WardSetting,
                    ],
                    synchronize: true,
                    logging: false,
                    timezone: '+09:00',
                    extra: {
                        connectionLimit: 10,
                    },
                }),
            }),
        ],
        controllers: [app_controller_1.AppController, unified_controller_1.UnifiedController, models_controller_1.ModelsController],
        providers: [app_service_1.AppService, device_status_scheduler_1.DeviceStatusScheduler],
        exports: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map