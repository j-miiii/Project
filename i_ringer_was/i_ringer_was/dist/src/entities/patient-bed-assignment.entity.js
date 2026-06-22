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
exports.PatientBedAssignment = void 0;
const typeorm_1 = require("typeorm");
const patient_entity_1 = require("./patient.entity");
const bed_entity_1 = require("./bed.entity");
const device_entity_1 = require("./device.entity");
const drug_order_entity_1 = require("./drug-order.entity");
const infusion_entity_1 = require("./infusion.entity");
const notification_entity_1 = require("./notification.entity");
const infusion_event_log_entity_1 = require("./infusion-event-log.entity");
let PatientBedAssignment = class PatientBedAssignment {
};
exports.PatientBedAssignment = PatientBedAssignment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "patient_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "bed_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "device_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "drug_order_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '수액 ID' }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "infusion_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], PatientBedAssignment.prototype, "infusion_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, nullable: true, comment: '수액 영문 약어 (NS, DW, HD, KCL 등)' }),
    __metadata("design:type", String)
], PatientBedAssignment.prototype, "infusion_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "infusion_total_volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 6, scale: 2, nullable: true, default: 0, comment: '처방 GTT (방울/분)' }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "infusion_gtt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '처방 CCHR (ml/hr)' }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "infusion_cchr", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '현재 투여량 (ml)' }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "infusion_current_volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0, comment: '이전 투여량 (ml)' }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "last_current_volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['stop', 'done', 'fast', 'slow', 'almost_done', 'disconnected'], nullable: true, comment: '알림 타입' }),
    __metadata("design:type", String)
], PatientBedAssignment.prototype, "alert_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], PatientBedAssignment.prototype, "assigned_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], PatientBedAssignment.prototype, "released_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '마지막 측정 무게(g) - LOAD_CELL용' }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "last_measured_weight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true, comment: '마지막 측정 시간(마이크로초) - LOAD_CELL용' }),
    __metadata("design:type", Number)
], PatientBedAssignment.prototype, "last_measured_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true, comment: '첫 번째 gtt=0 감지 시간' }),
    __metadata("design:type", Date)
], PatientBedAssignment.prototype, "first_zero_gtt_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true, comment: '첫 번째 cchr=0 감지 시간' }),
    __metadata("design:type", Date)
], PatientBedAssignment.prototype, "first_zero_cchr_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['pending', 'infusing', 'paused', 'completed', 'canceled'], default: 'pending', comment: '투여 상태' }),
    __metadata("design:type", String)
], PatientBedAssignment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true, comment: '활성 여부' }),
    __metadata("design:type", Boolean)
], PatientBedAssignment.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true, comment: '투여 시작 시간' }),
    __metadata("design:type", Date)
], PatientBedAssignment.prototype, "started_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true, comment: '투여 중지 시간' }),
    __metadata("design:type", Date)
], PatientBedAssignment.prototype, "stopped_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['critical', 'caution', 'system_error'], nullable: true, comment: '알림 카테고리' }),
    __metadata("design:type", String)
], PatientBedAssignment.prototype, "alert_category", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PatientBedAssignment.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], PatientBedAssignment.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => patient_entity_1.Patient, patient => patient.bedAssignments),
    (0, typeorm_1.JoinColumn)({ name: 'patient_id' }),
    __metadata("design:type", patient_entity_1.Patient)
], PatientBedAssignment.prototype, "patient", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => bed_entity_1.Bed, bed => bed.bedAssignments),
    (0, typeorm_1.JoinColumn)({ name: 'bed_id' }),
    __metadata("design:type", bed_entity_1.Bed)
], PatientBedAssignment.prototype, "bed", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => device_entity_1.Device, device => device.bedAssignments, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'device_id' }),
    __metadata("design:type", device_entity_1.Device)
], PatientBedAssignment.prototype, "device", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => drug_order_entity_1.DrugOrder, drugOrder => drugOrder.bedAssignments),
    (0, typeorm_1.JoinColumn)({ name: 'drug_order_id' }),
    __metadata("design:type", drug_order_entity_1.DrugOrder)
], PatientBedAssignment.prototype, "drugOrder", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => infusion_entity_1.Infusion, infusion => infusion.bedAssignments),
    (0, typeorm_1.JoinColumn)({ name: 'infusion_id' }),
    __metadata("design:type", infusion_entity_1.Infusion)
], PatientBedAssignment.prototype, "infusion", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => notification_entity_1.Notification, notification => notification.patientBedAssignment),
    __metadata("design:type", Array)
], PatientBedAssignment.prototype, "notifications", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => infusion_event_log_entity_1.InfusionEventLog, log => log.patientBedAssignment),
    __metadata("design:type", Array)
], PatientBedAssignment.prototype, "infusionEventLogs", void 0);
exports.PatientBedAssignment = PatientBedAssignment = __decorate([
    (0, typeorm_1.Entity)('patient_bed_assignments')
], PatientBedAssignment);
//# sourceMappingURL=patient-bed-assignment.entity.js.map