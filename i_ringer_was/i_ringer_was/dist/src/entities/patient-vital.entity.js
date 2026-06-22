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
exports.PatientVital = void 0;
const typeorm_1 = require("typeorm");
const patient_entity_1 = require("./patient.entity");
let PatientVital = class PatientVital {
};
exports.PatientVital = PatientVital;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PatientVital.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], PatientVital.prototype, "patient_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: 'visit 고유번호' }),
    __metadata("design:type", String)
], PatientVital.prototype, "adm", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 10, nullable: true, comment: '기록일자 (YYYYMMDD)' }),
    __metadata("design:type", String)
], PatientVital.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 10, nullable: true, comment: '기록시간 (HHmm)' }),
    __metadata("design:type", String)
], PatientVital.prototype, "time", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: '입력자 EMR key' }),
    __metadata("design:type", String)
], PatientVital.prototype, "nurse_key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 1, nullable: true, comment: '신장 (cm)' }),
    __metadata("design:type", Number)
], PatientVital.prototype, "height", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 1, nullable: true, comment: '체중 (kg)' }),
    __metadata("design:type", Number)
], PatientVital.prototype, "weight", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PatientVital.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], PatientVital.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => patient_entity_1.Patient, patient => patient.vitals),
    (0, typeorm_1.JoinColumn)({ name: 'patient_id' }),
    __metadata("design:type", patient_entity_1.Patient)
], PatientVital.prototype, "patient", void 0);
exports.PatientVital = PatientVital = __decorate([
    (0, typeorm_1.Entity)('patient_vitals')
], PatientVital);
//# sourceMappingURL=patient-vital.entity.js.map