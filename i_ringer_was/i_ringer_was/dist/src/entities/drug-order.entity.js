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
exports.DrugOrder = void 0;
const typeorm_1 = require("typeorm");
const patient_entity_1 = require("./patient.entity");
const infusion_entity_1 = require("./infusion.entity");
const patient_bed_assignment_entity_1 = require("./patient-bed-assignment.entity");
let DrugOrder = class DrugOrder {
};
exports.DrugOrder = DrugOrder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DrugOrder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], DrugOrder.prototype, "patient_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, comment: '수액 종류 ID (infusions FK)' }),
    __metadata("design:type", Number)
], DrugOrder.prototype, "infusion_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: '처방 코드' }),
    __metadata("design:type", String)
], DrugOrder.prototype, "order_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '처방 용량 (ml)' }),
    __metadata("design:type", Number)
], DrugOrder.prototype, "volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '처방 유속 (gtt/min)' }),
    __metadata("design:type", Number)
], DrugOrder.prototype, "gtt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '처방 유속 (ml/hr)' }),
    __metadata("design:type", Number)
], DrugOrder.prototype, "cchr", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 10, nullable: true, comment: '처방 일자 (YYYYMMDD)' }),
    __metadata("design:type", String)
], DrugOrder.prototype, "order_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['active', 'completed', 'canceled'], default: 'active', comment: '처방 상태' }),
    __metadata("design:type", String)
], DrugOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DrugOrder.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DrugOrder.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => patient_entity_1.Patient, patient => patient.drugOrders),
    (0, typeorm_1.JoinColumn)({ name: 'patient_id' }),
    __metadata("design:type", patient_entity_1.Patient)
], DrugOrder.prototype, "patient", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => infusion_entity_1.Infusion, infusion => infusion.drugOrders),
    (0, typeorm_1.JoinColumn)({ name: 'infusion_id' }),
    __metadata("design:type", infusion_entity_1.Infusion)
], DrugOrder.prototype, "infusion", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => patient_bed_assignment_entity_1.PatientBedAssignment, assignment => assignment.drugOrder),
    __metadata("design:type", Array)
], DrugOrder.prototype, "bedAssignments", void 0);
exports.DrugOrder = DrugOrder = __decorate([
    (0, typeorm_1.Entity)('drug_orders')
], DrugOrder);
//# sourceMappingURL=drug-order.entity.js.map