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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Patient = void 0;
const typeorm_1 = require("typeorm");
const patient_bed_assignment_entity_1 = require("./patient-bed-assignment.entity");
const patient_vital_entity_1 = require("./patient-vital.entity");
const drug_order_entity_1 = require("./drug-order.entity");
let Patient = class Patient {
};
exports.Patient = Patient;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Patient.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], Patient.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true }),
    __metadata("design:type", String)
], Patient.prototype, "chart_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 1, nullable: true, comment: '성별 (M/F)' }),
    __metadata("design:type", String)
], Patient.prototype, "sex", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '나이' }),
    __metadata("design:type", Number)
], Patient.prototype, "age", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 10, nullable: true, comment: '생년월일 (YYMMDD)' }),
    __metadata("design:type", String)
], Patient.prototype, "dob", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, nullable: true, comment: '진료과 코드' }),
    __metadata("design:type", String)
], Patient.prototype, "dept", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: '진료의' }),
    __metadata("design:type", String)
], Patient.prototype, "doc", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: '주치의' }),
    __metadata("design:type", String)
], Patient.prototype, "resident", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: '담당간호사' }),
    __metadata("design:type", String)
], Patient.prototype, "pa_nurse", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: '환자 visit별 고유번호' }),
    __metadata("design:type", String)
], Patient.prototype, "adm", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Patient.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Patient.prototype, "udpated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => patient_bed_assignment_entity_1.PatientBedAssignment, assignment => assignment.patient),
    __metadata("design:type", Array)
], Patient.prototype, "bedAssignments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => patient_vital_entity_1.PatientVital, vital => vital.patient),
    __metadata("design:type", Array)
], Patient.prototype, "vitals", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => drug_order_entity_1.DrugOrder, order => order.patient),
    __metadata("design:type", Array)
], Patient.prototype, "drugOrders", void 0);
exports.Patient = Patient = __decorate([
    (0, typeorm_1.Entity)('patients')
], Patient);
//# sourceMappingURL=patient.entity.js.map