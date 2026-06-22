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
exports.EmrService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../entities/user.entity");
const ward_entity_1 = require("../entities/ward.entity");
const room_entity_1 = require("../entities/room.entity");
const bed_entity_1 = require("../entities/bed.entity");
const patient_entity_1 = require("../entities/patient.entity");
const patient_bed_assignment_entity_1 = require("../entities/patient-bed-assignment.entity");
const device_entity_1 = require("../entities/device.entity");
const drug_order_entity_1 = require("../entities/drug-order.entity");
const patient_vital_entity_1 = require("../entities/patient-vital.entity");
let EmrService = class EmrService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async getMyWard(userId) {
        const userRepo = this.dataSource.getRepository(user_entity_1.User);
        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) {
            return { success: false, message: '사용자를 찾을 수 없습니다' };
        }
        if (!user.ward_id) {
            return { success: false, message: '배정된 병동이 없습니다' };
        }
        const wardRepo = this.dataSource.getRepository(ward_entity_1.Ward);
        const ward = await wardRepo.findOne({ where: { id: user.ward_id } });
        if (!ward) {
            return { success: false, message: '병동 정보를 찾을 수 없습니다' };
        }
        const queryBuilder = this.dataSource
            .createQueryBuilder()
            .select([
            'r.id as roomId',
            'r.name as roomName',
            'r.code as roomCode',
            'r.type as roomType',
            'b.id as bedId',
            'b.bed_number as bedNumber',
            'b.status as bedStatus',
            'pba.id as assignmentId',
            'pba.patient_id as patientId',
            'pba.device_id as deviceId',
            'pba.drug_order_id as drugOrderId',
            'pba.infusion_type as infusionType',
            'pba.infusion_total_volume as totalVolume',
            'pba.infusion_current_volume as currentVolume',
            'pba.infusion_gtt as infusionGtt',
            'pba.infusion_cchr as infusionCchr',
            'pba.alert_type as alertType',
            'pba.assigned_at as assignedAt',
            'p.id as pId',
            'p.name as patientName',
            'p.chart_number as chartNumber',
            'p.sex as sex',
            'p.age as age',
            'p.dept as dept',
            'p.doc as doc',
            'p.resident as resident',
            'p.pa_nurse as paNurse',
            'p.adm as adm',
        ])
            .from(room_entity_1.Room, 'r')
            .innerJoin(bed_entity_1.Bed, 'b', 'b.room_id = r.id')
            .leftJoin(patient_bed_assignment_entity_1.PatientBedAssignment, 'pba', 'pba.bed_id = b.id AND pba.released_at IS NULL')
            .leftJoin(patient_entity_1.Patient, 'p', 'p.id = pba.patient_id')
            .where('r.ward_id = :wardId', { wardId: user.ward_id })
            .orderBy('r.name', 'ASC')
            .addOrderBy('b.bed_number', 'ASC');
        const results = await queryBuilder.getRawMany();
        const deviceIds = [...new Set(results.map(r => r.deviceId).filter(Boolean))];
        const drugOrderIds = [...new Set(results.map(r => r.drugOrderId).filter(Boolean))];
        const deviceMap = new Map();
        if (deviceIds.length > 0) {
            const deviceRepo = this.dataSource.getRepository(device_entity_1.Device);
            const devices = await deviceRepo
                .createQueryBuilder('d')
                .where('d.id IN (:...ids)', { ids: deviceIds })
                .getMany();
            devices.forEach(d => deviceMap.set(d.id, d));
        }
        const drugOrderMap = new Map();
        if (drugOrderIds.length > 0) {
            const drugOrderRepo = this.dataSource.getRepository(drug_order_entity_1.DrugOrder);
            const orders = await drugOrderRepo
                .createQueryBuilder('do')
                .where('do.id IN (:...ids)', { ids: drugOrderIds })
                .getMany();
            orders.forEach(o => drugOrderMap.set(o.id, o));
        }
        const roomsMap = new Map();
        results.forEach(row => {
            if (!roomsMap.has(row.roomId)) {
                roomsMap.set(row.roomId, {
                    room_id: row.roomId,
                    room_name: row.roomName,
                    room_code: row.roomCode,
                    room_type: row.roomType,
                    beds: [],
                });
            }
            const room = roomsMap.get(row.roomId);
            const bedData = {
                bed_id: row.bedId,
                bed_number: row.bedNumber,
                bed_status: row.bedStatus,
            };
            if (row.patientId) {
                const percentage = row.totalVolume
                    ? Math.round((row.currentVolume / row.totalVolume) * 100)
                    : 0;
                const device = row.deviceId ? deviceMap.get(row.deviceId) : null;
                const drugOrder = row.drugOrderId ? drugOrderMap.get(row.drugOrderId) : null;
                bedData.patient = {
                    id: row.pId,
                    name: row.patientName,
                    chart_number: row.chartNumber,
                    sex: row.sex,
                    age: row.age,
                    dept: row.dept,
                    doc: row.doc,
                    resident: row.resident,
                    pa_nurse: row.paNurse,
                    adm: row.adm,
                };
                bedData.assignment = {
                    id: row.assignmentId,
                    infusion_type: row.infusionType,
                    total_volume: row.totalVolume,
                    current_volume: row.currentVolume,
                    infusion_gtt: row.infusionGtt,
                    infusion_cchr: row.infusionCchr,
                    infusion_percentage: percentage,
                    alert_type: row.alertType,
                    assigned_at: row.assignedAt,
                    drug_order: drugOrder
                        ? {
                            id: drugOrder.id,
                            order_code: drugOrder.order_code,
                            order_name: drugOrder.order_name,
                            order_date: drugOrder.order_date,
                            dc_yn: drugOrder.dc_yn,
                            qty: drugOrder.qty,
                            method_name: drugOrder.method_name,
                            is_fluid: drugOrder.is_fluid,
                        }
                        : null,
                    device: device
                        ? {
                            id: device.id,
                            device_name: device.device_name,
                            serial_number: device.serial_number,
                            status: device.network_status || 'unknown',
                            battery_percent: device.battery_percent || 0,
                            last_udpate_at: device.last_udpate_at,
                        }
                        : null,
                };
            }
            room.beds.push(bedData);
        });
        return {
            success: true,
            data: {
                ward: {
                    id: ward.id,
                    name: ward.name,
                    code: ward.code,
                },
                rooms: Array.from(roomsMap.values()),
            },
        };
    }
    async getPatientOrders(patientId, query) {
        const repo = this.dataSource.getRepository(drug_order_entity_1.DrugOrder);
        const qb = repo
            .createQueryBuilder('do')
            .where('do.patient_id = :patientId', { patientId });
        if (query?.dc_yn) {
            qb.andWhere('do.dc_yn = :dcYn', { dcYn: query.dc_yn });
        }
        if (query?.order_date) {
            qb.andWhere('do.order_date = :orderDate', { orderDate: query.order_date });
        }
        qb.orderBy('do.order_date', 'DESC').addOrderBy('do.id', 'DESC');
        const orders = await qb.getMany();
        return {
            success: true,
            data: orders,
        };
    }
    async getPatientVitals(patientId) {
        const repo = this.dataSource.getRepository(patient_vital_entity_1.PatientVital);
        const vitals = await repo.find({
            where: { patient_id: patientId },
            order: { date: 'DESC', time: 'DESC' },
        });
        return {
            success: true,
            data: vitals,
        };
    }
};
exports.EmrService = EmrService;
exports.EmrService = EmrService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], EmrService);
//# sourceMappingURL=emr.service.js.map