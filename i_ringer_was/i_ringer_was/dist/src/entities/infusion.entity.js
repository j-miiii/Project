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
exports.Infusion = void 0;
const typeorm_1 = require("typeorm");
const drug_order_entity_1 = require("./drug-order.entity");
const patient_bed_assignment_entity_1 = require("./patient-bed-assignment.entity");
let Infusion = class Infusion {
};
exports.Infusion = Infusion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Infusion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, nullable: true, comment: '영문 약어 (NS, DW, HD 등)' }),
    __metadata("design:type", String)
], Infusion.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, comment: '수액명' }),
    __metadata("design:type", String)
], Infusion.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '기본 용량 (ml)' }),
    __metadata("design:type", Number)
], Infusion.prototype, "default_volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '기본 유속 (gtt/min)' }),
    __metadata("design:type", Number)
], Infusion.prototype, "default_gtt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true, comment: '기본 유속 (cc/hr)' }),
    __metadata("design:type", Number)
], Infusion.prototype, "default_cchr", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 500, nullable: true, comment: '설명' }),
    __metadata("design:type", String)
], Infusion.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true, comment: '활성 여부' }),
    __metadata("design:type", Boolean)
], Infusion.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0, comment: '표시순서' }),
    __metadata("design:type", Number)
], Infusion.prototype, "display_order", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0, comment: '사용횟수' }),
    __metadata("design:type", Number)
], Infusion.prototype, "usage_count", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Infusion.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Infusion.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => drug_order_entity_1.DrugOrder, order => order.infusion),
    __metadata("design:type", Array)
], Infusion.prototype, "drugOrders", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => patient_bed_assignment_entity_1.PatientBedAssignment, assignment => assignment.infusion),
    __metadata("design:type", Array)
], Infusion.prototype, "bedAssignments", void 0);
exports.Infusion = Infusion = __decorate([
    (0, typeorm_1.Entity)('infusions')
], Infusion);
//# sourceMappingURL=infusion.entity.js.map