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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const patient_entity_1 = require("../entities/patient.entity");
const patient_bed_assignment_entity_1 = require("../entities/patient-bed-assignment.entity");
const bed_entity_1 = require("../entities/bed.entity");
const room_entity_1 = require("../entities/room.entity");
const ward_entity_1 = require("../entities/ward.entity");
const hospital_entity_1 = require("../entities/hospital.entity");
const device_entity_1 = require("../entities/device.entity");
const user_entity_1 = require("../entities/user.entity");
const nurse_room_assignment_entity_1 = require("../entities/nurse-room-assignment.entity");
const infusion_raw_log_entity_1 = require("../entities/infusion-raw-log.entity");
const infusion_entity_1 = require("../entities/infusion.entity");
const mqtt_service_1 = require("../mqtt/mqtt.service");
let MonitoringService = class MonitoringService {
    constructor(dataSource, mqttService) {
        this.dataSource = dataSource;
        this.mqttService = mqttService;
    }
    async getBedInfo(bedId) {
        const bedRepository = this.dataSource.getRepository(bed_entity_1.Bed);
        const bed = await bedRepository.findOne({
            where: { id: bedId },
            relations: ['room', 'room.ward', 'room.ward.hospital']
        });
        if (!bed) {
            return {
                success: false,
                statusCode: 404,
                message: `Bed with id ${bedId} not found`
            };
        }
        if (!bed.room || !bed.room.ward || !bed.room.ward.hospital) {
            return {
                success: false,
                statusCode: 404,
                message: `Incomplete hierarchy for bed ${bedId}`
            };
        }
        const userRepository = this.dataSource.getRepository(user_entity_1.User);
        const nurses = await userRepository.find({
            where: {
                hospital_id: bed.room.ward.hospital_id,
                ward_id: bed.room.ward_id
            }
        });
        const filteredNurses = nurses
            .filter(user => user.role === 'admin' || user.role === 'nurse')
            .map(user => ({
            id: user.id,
            nickname: user.nickname,
            auth_id: user.auth_id,
            role: user.role
        }));
        return {
            success: true,
            data: {
                bed: {
                    id: bed.id,
                    bed_number: bed.bed_number,
                    status: bed.status
                },
                room: {
                    id: bed.room.id,
                    name: bed.room.name
                },
                ward: {
                    id: bed.room.ward.id,
                    name: bed.room.ward.name
                },
                hospital: {
                    id: bed.room.ward.hospital.id,
                    name: bed.room.ward.hospital.name
                },
                nurses: filteredNurses
            }
        };
    }
    async releaseBulkAssignments(assignmentIds) {
        const results = [];
        const successfulAssignmentIds = [];
        for (const assignmentId of assignmentIds) {
            const result = await this.releaseAssignment(assignmentId);
            results.push({
                assignment_id: assignmentId,
                ...result
            });
            if (result.success) {
                successfulAssignmentIds.push(assignmentId);
            }
        }
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
        const hasFailures = failedCount > 0;
        if (successfulAssignmentIds.length > 0) {
            await this.sendBulkReleaseRefreshNotification(successfulAssignmentIds);
        }
        return {
            success: true,
            message: `Bulk release completed: ${successCount} succeeded, ${failedCount} failed`,
            data: {
                total: results.length,
                succeeded: successCount,
                failed: failedCount,
                hasFailures: hasFailures,
                results: results
            }
        };
    }
    async clearInfusion(assignmentId) {
        const assignmentRepository = this.dataSource.getRepository(patient_bed_assignment_entity_1.PatientBedAssignment);
        const assignment = await assignmentRepository.findOne({
            where: { id: assignmentId }
        });
        if (!assignment) {
            return {
                success: false,
                statusCode: 404,
                message: `Assignment with id ${assignmentId} not found`
            };
        }
        const now = new Date();
        await assignmentRepository.update(assignmentId, {
            released_at: now,
            status: 'completed'
        });
        if (assignment.device_id) {
            const deviceRepository = this.dataSource.getRepository(device_entity_1.Device);
            await deviceRepository.update(assignment.device_id, {
                bed_id: null,
                room_id: null,
                last_udpate_at: now
            });
        }
        const newAssignment = assignmentRepository.create({
            patient_id: assignment.patient_id,
            bed_id: assignment.bed_id,
            drug_order_id: assignment.drug_order_id,
            assigned_at: now,
            status: 'pending',
        });
        const savedNewAssignment = await assignmentRepository.save(newAssignment);
        if (assignment.bed_id) {
            try {
                const bedRepository = this.dataSource.getRepository(bed_entity_1.Bed);
                const bed = await bedRepository.findOne({
                    where: { id: assignment.bed_id },
                    relations: ['room', 'room.ward']
                });
                if (bed?.room?.ward?.hospital_id) {
                    await this.sendAssignmentRefreshNotification(bed.room.ward.hospital_id, {
                        assignment_id: savedNewAssignment.id,
                        bed_id: assignment.bed_id,
                        action: 'clear_infusion'
                    });
                }
            }
            catch (mqttError) {
                console.error(`[CLEAR INFUSION] MQTT notification failed: ${mqttError.message}`);
            }
        }
        return {
            success: true,
            statusCode: 200,
            message: `Infusion cleared and new record created for old assignment ${assignmentId}`,
            data: {
                assignment_id: savedNewAssignment.id,
            }
        };
    }
    async releaseAssignment(assignmentId) {
        const assignmentRepository = this.dataSource.getRepository(patient_bed_assignment_entity_1.PatientBedAssignment);
        const assignment = await assignmentRepository.findOne({
            where: { id: assignmentId }
        });
        if (!assignment) {
            return {
                success: false,
                statusCode: 404,
                message: `Assignment with id ${assignmentId} not found`
            };
        }
        if (assignment.released_at) {
            return {
                success: false,
                statusCode: 409,
                message: `Assignment with id ${assignmentId} is already released`
            };
        }
        if (assignment.device_id) {
            const deviceRepository = this.dataSource.getRepository(device_entity_1.Device);
            const device = await deviceRepository.findOne({
                where: { id: assignment.device_id }
            });
            if (!device) {
                return {
                    success: false,
                    statusCode: 404,
                    message: `Device with id ${assignment.device_id} not found`
                };
            }
            await deviceRepository.update(assignment.device_id, {
                bed_id: null,
                room_id: null,
                last_udpate_at: new Date()
            });
        }
        const now = new Date();
        if (!assignment.infusion_type && !assignment.infusion_total_volume) {
            await assignmentRepository.delete(assignmentId);
        }
        else {
            await assignmentRepository.update(assignmentId, {
                released_at: now,
                status: 'completed'
            });
        }
        if (assignment.bed_id) {
            const bedRepository = this.dataSource.getRepository(bed_entity_1.Bed);
            await bedRepository.update(assignment.bed_id, {
                status: 'available'
            });
        }
        if (assignment.bed_id) {
            try {
                const bedRepository = this.dataSource.getRepository(bed_entity_1.Bed);
                const bed = await bedRepository.findOne({
                    where: { id: assignment.bed_id },
                    relations: ['room', 'room.ward']
                });
                if (bed?.room?.ward?.hospital_id) {
                    await this.sendAssignmentRefreshNotification(bed.room.ward.hospital_id, {
                        assignment_id: assignmentId,
                        bed_id: assignment.bed_id,
                        action: 'release'
                    });
                }
            }
            catch (mqttError) {
                console.error(`[ASSIGNMENT RELEASE] MQTT notification failed: ${mqttError.message}`);
            }
        }
        return {
            success: true,
            statusCode: 200,
            message: `Assignment ${assignmentId} successfully released or deleted if empty`,
            data: {
                assignment_id: assignmentId,
                released_at: now
            }
        };
    }
    async getMonitoringData(filters) {
        const queryBuilder = this.dataSource
            .createQueryBuilder()
            .select([
            'h.id as hospitalId',
            'h.name as hospitalName',
            'w.id as wardId',
            'w.name as wardName',
            'r.id as roomId',
            'r.name as roomNumber',
            'b.id as bedId',
            'b.bed_number as bedNumber',
            'b.status as bedStatus',
            'pba.id as assignmentId',
            'pba.patient_id as patientId',
            'pba.assigned_at as assignedAt',
            'pba.infusion_type as infusionType',
            'pba.infusion_total_volume as totalVolume',
            'pba.infusion_current_volume as currentVolume',
            'pba.infusion_cchr as infusionCchr',
            'pba.alert_type as alertType',
            'p.name as patientName',
            'p.chart_number as registrationNumber',
            'p.sex as patientGender',
            'p.age as patientAge',
        ])
            .from(ward_entity_1.Ward, 'w')
            .innerJoin(hospital_entity_1.Hospital, 'h', 'h.id = w.hospital_id')
            .innerJoin(room_entity_1.Room, 'r', 'r.ward_id = w.id')
            .innerJoin(bed_entity_1.Bed, 'b', 'b.room_id = r.id')
            .leftJoin(patient_bed_assignment_entity_1.PatientBedAssignment, 'pba', 'pba.bed_id = b.id AND pba.released_at IS NULL')
            .leftJoin(patient_entity_1.Patient, 'p', 'p.id = pba.patient_id');
        if (filters.hospitalId) {
            queryBuilder.andWhere('h.id = :hospitalId', {
                hospitalId: filters.hospitalId
            });
        }
        if (filters.wardId) {
            queryBuilder.andWhere('w.id = :wardId', {
                wardId: filters.wardId
            });
        }
        if (filters.roomIds && filters.roomIds.length > 0) {
            queryBuilder.andWhere('r.id IN (:...roomIds)', {
                roomIds: filters.roomIds
            });
        }
        queryBuilder
            .orderBy('h.id', 'ASC')
            .addOrderBy('w.id', 'ASC')
            .addOrderBy('r.name', 'ASC')
            .addOrderBy('b.bed_number', 'ASC');
        const results = await queryBuilder.getRawMany();
        const hospitalsMap = new Map();
        const bedIds = [];
        results.forEach(row => {
            bedIds.push(row.bedId);
            if (!hospitalsMap.has(row.hospitalId)) {
                hospitalsMap.set(row.hospitalId, {
                    hospital_id: row.hospitalId,
                    hospital_name: row.hospitalName,
                    wards: []
                });
            }
            const hospital = hospitalsMap.get(row.hospitalId);
            let ward = hospital.wards.find(w => w.ward_id === row.wardId);
            if (!ward) {
                ward = {
                    ward_id: row.wardId,
                    ward_name: row.wardName,
                    rooms: []
                };
                hospital.wards.push(ward);
            }
            let room = ward.rooms.find(r => r.room_id === row.roomId);
            if (!room) {
                room = {
                    room_id: row.roomId,
                    room_number: row.roomNumber,
                    nurse: null,
                    beds: []
                };
                ward.rooms.push(room);
            }
            const bedData = {
                bed_id: row.bedId,
                bed_number: row.bedNumber,
                bed_status: row.bedStatus,
            };
            if (row.patientId) {
                bedData.patient_info = {
                    id: row.patientId,
                    name: row.patientName,
                    chart_number: row.registrationNumber,
                    gender: row.patientGender || null,
                    age: row.patientAge || null,
                };
            }
            room.beds.push(bedData);
        });
        const allRoomIds = [...new Set(results.map(r => r.roomId).filter(id => id))];
        if (allRoomIds.length > 0) {
            const nurseAssignmentRepo = this.dataSource.getRepository(nurse_room_assignment_entity_1.NurseRoomAssignment);
            const nurseAssignments = await nurseAssignmentRepo
                .createQueryBuilder('nra')
                .leftJoinAndSelect('nra.user', 'user')
                .where('nra.room_id IN (:...roomIds)', { roomIds: allRoomIds })
                .andWhere('nra.is_active = :isActive', { isActive: true })
                .getMany();
            const nurseByRoomId = new Map();
            nurseAssignments.forEach(nra => {
                if (nra.user && !nurseByRoomId.has(nra.room_id)) {
                    nurseByRoomId.set(nra.room_id, {
                        id: nra.user.id,
                        nickname: nra.user.nickname,
                        employee_number: nra.user.employee_number || null,
                        profile_image: nra.user.profile_image || '/images/default_profile.png',
                    });
                }
            });
            hospitalsMap.forEach(hospital => {
                hospital.wards.forEach(ward => {
                    ward.rooms.forEach(room => {
                        room.nurse = nurseByRoomId.get(room.room_id) || null;
                    });
                });
            });
        }
        if (bedIds.length > 0) {
            const assignmentRepository = this.dataSource.getRepository(patient_bed_assignment_entity_1.PatientBedAssignment);
            const assignments = await assignmentRepository
                .createQueryBuilder('pba')
                .where('pba.bed_id IN (:...bedIds)', { bedIds })
                .andWhere('pba.released_at IS NULL')
                .getMany();
            const needCodeAssignments = assignments.filter(a => !a.infusion_code && a.infusion_type);
            if (needCodeAssignments.length > 0) {
                const infusionRepo = this.dataSource.getRepository(infusion_entity_1.Infusion);
                const infusions = await infusionRepo.find();
                needCodeAssignments.forEach(a => {
                    const exact = infusions.find(inf => inf.name === a.infusion_type);
                    if (exact) {
                        a.infusion_code = exact.code;
                        return;
                    }
                    const partial = infusions.find(inf => inf.name.includes(a.infusion_type));
                    if (partial) {
                        a.infusion_code = partial.code;
                        return;
                    }
                });
            }
            const deviceIds = [...new Set(assignments.map(a => a.device_id).filter(id => id))];
            const deviceMap = new Map();
            if (deviceIds.length > 0) {
                const deviceRepository = this.dataSource.getRepository(device_entity_1.Device);
                const devices = await deviceRepository
                    .createQueryBuilder('device')
                    .where('device.id IN (:...deviceIds)', { deviceIds })
                    .getMany();
                devices.forEach(device => {
                    deviceMap.set(device.id, device);
                });
            }
            const assignmentsByBedId = new Map();
            assignments.forEach(assignment => {
                if (!assignmentsByBedId.has(assignment.bed_id)) {
                    assignmentsByBedId.set(assignment.bed_id, []);
                }
                assignmentsByBedId.get(assignment.bed_id).push(assignment);
            });
            const measuredCchrMap = new Map();
            if (deviceIds.length > 0) {
                const rawLogRepository = this.dataSource.getRepository(infusion_raw_log_entity_1.InfusionRawLog);
                const latestLogs = await rawLogRepository
                    .createQueryBuilder('log')
                    .select(['log.sn', 'log.cchr'])
                    .innerJoin(device_entity_1.Device, 'device', 'device.serial_number = log.sn')
                    .where('device.id IN (:...deviceIds)', { deviceIds })
                    .andWhere('log.cchr IS NOT NULL')
                    .andWhere('log.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)')
                    .orderBy('log.created_at', 'DESC')
                    .getMany();
                const snToDeviceId = new Map();
                deviceMap.forEach((device, id) => {
                    snToDeviceId.set(device.serial_number, id);
                });
                latestLogs.forEach(log => {
                    const devId = snToDeviceId.get(log.sn);
                    if (devId && !measuredCchrMap.has(devId)) {
                        measuredCchrMap.set(devId, log.cchr);
                    }
                });
            }
            hospitalsMap.forEach(hospital => {
                hospital.wards.forEach(ward => {
                    ward.rooms.forEach(room => {
                        room.beds.forEach(bed => {
                            const bedAssignments = assignmentsByBedId.get(bed.bed_id) || [];
                            bed.assignments = bedAssignments.map(assignment => {
                                const percentage = assignment.infusion_total_volume
                                    ? Math.floor((assignment.infusion_current_volume / assignment.infusion_total_volume) * 100)
                                    : 0;
                                const device = assignment.device_id ? deviceMap.get(assignment.device_id) : null;
                                const measuredCchr = assignment.device_id ? (measuredCchrMap.get(assignment.device_id) ?? null) : null;
                                return {
                                    ...assignment,
                                    infusion_cchr: assignment.infusion_cchr ?? null,
                                    measured_cchr: measuredCchr,
                                    infusion_percentage: percentage,
                                    device: device ? {
                                        id: device.id,
                                        device_name: device.device_name,
                                        serial_number: device.serial_number,
                                        status: device.network_status || 'unknown',
                                        batteryLevel: device.battery_percent || 0,
                                        firmware_version: device.firmware_version,
                                        last_udpate_at: device.last_udpate_at,
                                    } : null
                                };
                            });
                        });
                    });
                });
            });
        }
        const hospitalsArray = Array.from(hospitalsMap.values());
        if (hospitalsArray.length === 1) {
            return {
                success: true,
                hospital_id: hospitalsArray[0].hospital_id,
                hospital_name: hospitalsArray[0].hospital_name,
                data: hospitalsArray[0].wards,
                timestamp: new Date(),
            };
        }
        return {
            success: true,
            data: hospitalsArray,
            timestamp: new Date(),
        };
    }
    async sendAssignmentRefreshNotification(hospitalId, payload) {
        try {
            const userRepository = this.dataSource.getRepository(user_entity_1.User);
            const users = await userRepository.find({
                where: { hospital_id: hospitalId }
            });
            const targetUsers = users.filter(user => user.role === 'admin' || user.role === 'nurse');
            for (const user of targetUsers) {
                const topic = `user/${user.id}/assignment/refresh`;
                this.mqttService.publishMessage(topic, payload);
            }
            console.log(`[ASSIGNMENT REFRESH] Sent notification to ${targetUsers.length} users in hospital ${hospitalId}`);
        }
        catch (error) {
            console.error(`[ASSIGNMENT REFRESH ERROR] ${error.message}`);
        }
    }
    async sendBulkReleaseRefreshNotification(assignmentIds) {
        try {
            const assignmentRepository = this.dataSource.getRepository(patient_bed_assignment_entity_1.PatientBedAssignment);
            const assignments = await assignmentRepository
                .createQueryBuilder('assignment')
                .leftJoinAndSelect('assignment.bed', 'bed')
                .leftJoinAndSelect('bed.room', 'room')
                .leftJoinAndSelect('room.ward', 'ward')
                .where('assignment.id IN (:...ids)', { ids: assignmentIds })
                .getMany();
            const hospitalAssignmentsMap = new Map();
            for (const assignment of assignments) {
                if (assignment.bed?.room?.ward?.hospital_id) {
                    const hospitalId = assignment.bed.room.ward.hospital_id;
                    if (!hospitalAssignmentsMap.has(hospitalId)) {
                        hospitalAssignmentsMap.set(hospitalId, []);
                    }
                    hospitalAssignmentsMap.get(hospitalId).push(assignment.id);
                }
            }
            for (const [hospitalId, releasedAssignmentIds] of hospitalAssignmentsMap.entries()) {
                await this.sendAssignmentRefreshNotification(hospitalId, {
                    assignment_ids: releasedAssignmentIds,
                    action: 'bulk_release',
                    timestamp: new Date().toISOString()
                });
            }
        }
        catch (error) {
            console.error('[BULK RELEASE ERROR] Failed to send refresh notification:', error);
        }
    }
};
exports.MonitoringService = MonitoringService;
exports.MonitoringService = MonitoringService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => mqtt_service_1.MqttService))),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        mqtt_service_1.MqttService])
], MonitoringService);
//# sourceMappingURL=monitoring.service.js.map