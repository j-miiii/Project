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
exports.InfusionEventLog = void 0;
const typeorm_1 = require("typeorm");
const patient_bed_assignment_entity_1 = require("./patient-bed-assignment.entity");
const user_entity_1 = require("./user.entity");
let InfusionEventLog = class InfusionEventLog {
};
exports.InfusionEventLog = InfusionEventLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InfusionEventLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: false }),
    __metadata("design:type", Number)
], InfusionEventLog.prototype, "patient_bed_assignment_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['start', 'pause', 'resume', 'complete', 'cancel', 'alert', 'modify'], nullable: false, comment: '이벤트 유형' }),
    __metadata("design:type", String)
], InfusionEventLog.prototype, "event_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true, comment: '변경 전 값' }),
    __metadata("design:type", Object)
], InfusionEventLog.prototype, "before_value", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true, comment: '변경 후 값' }),
    __metadata("design:type", Object)
], InfusionEventLog.prototype, "after_value", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, comment: '수행자 (간호사 user_id)' }),
    __metadata("design:type", Number)
], InfusionEventLog.prototype, "performed_by", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], InfusionEventLog.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], InfusionEventLog.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => patient_bed_assignment_entity_1.PatientBedAssignment, assignment => assignment.infusionEventLogs, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'patient_bed_assignment_id' }),
    __metadata("design:type", patient_bed_assignment_entity_1.PatientBedAssignment)
], InfusionEventLog.prototype, "patientBedAssignment", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'performed_by' }),
    __metadata("design:type", user_entity_1.User)
], InfusionEventLog.prototype, "performer", void 0);
exports.InfusionEventLog = InfusionEventLog = __decorate([
    (0, typeorm_1.Entity)('infusion_event_logs')
], InfusionEventLog);
//# sourceMappingURL=infusion-event-log.entity.js.map