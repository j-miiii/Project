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
exports.Bed = void 0;
const typeorm_1 = require("typeorm");
const room_entity_1 = require("./room.entity");
const patient_bed_assignment_entity_1 = require("./patient-bed-assignment.entity");
const device_entity_1 = require("./device.entity");
let Bed = class Bed {
};
exports.Bed = Bed;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Bed.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Bed.prototype, "room_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true }),
    __metadata("design:type", String)
], Bed.prototype, "bed_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['available', 'occupied', 'maintenance'], default: 'available', nullable: true }),
    __metadata("design:type", String)
], Bed.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Bed.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Bed.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => room_entity_1.Room, room => room.beds),
    (0, typeorm_1.JoinColumn)({ name: 'room_id' }),
    __metadata("design:type", room_entity_1.Room)
], Bed.prototype, "room", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => device_entity_1.Device, device => device.bed),
    __metadata("design:type", Array)
], Bed.prototype, "devices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => patient_bed_assignment_entity_1.PatientBedAssignment, assignment => assignment.bed),
    __metadata("design:type", Array)
], Bed.prototype, "bedAssignments", void 0);
exports.Bed = Bed = __decorate([
    (0, typeorm_1.Entity)('beds')
], Bed);
//# sourceMappingURL=bed.entity.js.map