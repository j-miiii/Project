"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const monitoring_controller_1 = require("./monitoring.controller");
const monitoring_service_1 = require("./monitoring.service");
const app_module_1 = require("../app.module");
const mqtt_module_1 = require("../mqtt/mqtt.module");
const patient_entity_1 = require("../entities/patient.entity");
const patient_bed_assignment_entity_1 = require("../entities/patient-bed-assignment.entity");
const bed_entity_1 = require("../entities/bed.entity");
const room_entity_1 = require("../entities/room.entity");
const ward_entity_1 = require("../entities/ward.entity");
const hospital_entity_1 = require("../entities/hospital.entity");
const device_entity_1 = require("../entities/device.entity");
const user_entity_1 = require("../entities/user.entity");
const notification_entity_1 = require("../entities/notification.entity");
const user_setting_entity_1 = require("../entities/user-setting.entity");
const access_token_entity_1 = require("../entities/access-token.entity");
const infusion_raw_log_entity_1 = require("../entities/infusion-raw-log.entity");
let MonitoringModule = class MonitoringModule {
};
exports.MonitoringModule = MonitoringModule;
exports.MonitoringModule = MonitoringModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                patient_entity_1.Patient,
                patient_bed_assignment_entity_1.PatientBedAssignment,
                bed_entity_1.Bed,
                room_entity_1.Room,
                ward_entity_1.Ward,
                hospital_entity_1.Hospital,
                device_entity_1.Device,
                user_entity_1.User,
                notification_entity_1.Notification,
                user_setting_entity_1.UserSetting,
                access_token_entity_1.AccessToken,
                infusion_raw_log_entity_1.InfusionRawLog,
            ]),
            (0, common_1.forwardRef)(() => app_module_1.AppModule),
            (0, common_1.forwardRef)(() => mqtt_module_1.MqttModule),
        ],
        controllers: [monitoring_controller_1.MonitoringController],
        providers: [monitoring_service_1.MonitoringService],
        exports: [monitoring_service_1.MonitoringService],
    })
], MonitoringModule);
//# sourceMappingURL=monitoring.module.js.map