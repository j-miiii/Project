"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmrModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const emr_controller_1 = require("./emr.controller");
const emr_service_1 = require("./emr.service");
const auth_module_1 = require("../auth/auth.module");
const user_entity_1 = require("../entities/user.entity");
const ward_entity_1 = require("../entities/ward.entity");
const room_entity_1 = require("../entities/room.entity");
const bed_entity_1 = require("../entities/bed.entity");
const patient_entity_1 = require("../entities/patient.entity");
const patient_bed_assignment_entity_1 = require("../entities/patient-bed-assignment.entity");
const device_entity_1 = require("../entities/device.entity");
const drug_order_entity_1 = require("../entities/drug-order.entity");
const patient_vital_entity_1 = require("../entities/patient-vital.entity");
let EmrModule = class EmrModule {
};
exports.EmrModule = EmrModule;
exports.EmrModule = EmrModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                user_entity_1.User,
                ward_entity_1.Ward,
                room_entity_1.Room,
                bed_entity_1.Bed,
                patient_entity_1.Patient,
                patient_bed_assignment_entity_1.PatientBedAssignment,
                device_entity_1.Device,
                drug_order_entity_1.DrugOrder,
                patient_vital_entity_1.PatientVital,
            ]),
            auth_module_1.AuthModule,
        ],
        controllers: [emr_controller_1.EmrController],
        providers: [emr_service_1.EmrService],
        exports: [emr_service_1.EmrService],
    })
], EmrModule);
//# sourceMappingURL=emr.module.js.map