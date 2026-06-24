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
var AppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
const patient_entity_1 = require("./entities/patient.entity");
const hospital_entity_1 = require("./entities/hospital.entity");
const ward_entity_1 = require("./entities/ward.entity");
const room_entity_1 = require("./entities/room.entity");
const bed_entity_1 = require("./entities/bed.entity");
const device_entity_1 = require("./entities/device.entity");
const patient_bed_assignment_entity_1 = require("./entities/patient-bed-assignment.entity");
const infusion_raw_log_entity_1 = require("./entities/infusion-raw-log.entity");
const notification_entity_1 = require("./entities/notification.entity");
const user_setting_entity_1 = require("./entities/user-setting.entity");
const access_token_entity_1 = require("./entities/access-token.entity");
const user_lockout_status_entity_1 = require("./entities/user-lockout-status.entity");
const user_lockout_log_entity_1 = require("./entities/user-lockout-log.entity");
const drug_order_entity_1 = require("./entities/drug-order.entity");
const infusion_entity_1 = require("./entities/infusion.entity");
const patient_vital_entity_1 = require("./entities/patient-vital.entity");
const nurse_room_assignment_entity_1 = require("./entities/nurse-room-assignment.entity");
const term_entity_1 = require("./entities/term.entity");
const user_term_agreement_entity_1 = require("./entities/user-term-agreement.entity");
const infusion_event_log_entity_1 = require("./entities/infusion-event-log.entity");
const ward_setting_entity_1 = require("./entities/ward-setting.entity");
const mqtt_service_1 = require("./mqtt/mqtt.service");
const fcm_service_1 = require("./fcm/fcm.service");
function gttToCcHr(gtt) {
    return Math.round(gtt * 3.282);
}
function ccHrToGtt(ccHr) {
    return ccHr / 3.282;
}
let AppService = AppService_1 = class AppService {
    constructor(dataSource, mqttService, fcmService) {
        this.dataSource = dataSource;
        this.mqttService = mqttService;
        this.fcmService = fcmService;
        this.logger = new common_1.Logger(AppService_1.name);
        this.entityMap = {
            'users': user_entity_1.User,
            'patients': patient_entity_1.Patient,
            'hospitals': hospital_entity_1.Hospital,
            'wards': ward_entity_1.Ward,
            'rooms': room_entity_1.Room,
            'beds': bed_entity_1.Bed,
            'devices': device_entity_1.Device,
            'patient_bed_assignments': patient_bed_assignment_entity_1.PatientBedAssignment,
            'infusion_raw_logs': infusion_raw_log_entity_1.InfusionRawLog,
            'notifications': notification_entity_1.Notification,
            'user_settings': user_setting_entity_1.UserSetting,
            'access_tokens': access_token_entity_1.AccessToken,
            'user_lockout_status': user_lockout_status_entity_1.UserLockoutStatus,
            'user_lockout_log': user_lockout_log_entity_1.UserLockoutLog,
            'drug_orders': drug_order_entity_1.DrugOrder,
            'infusions': infusion_entity_1.Infusion,
            'patient_vitals': patient_vital_entity_1.PatientVital,
            'nurse_room_assignments': nurse_room_assignment_entity_1.NurseRoomAssignment,
            'terms': term_entity_1.Term,
            'user_term_agreements': user_term_agreement_entity_1.UserTermAgreement,
            'infusion_event_logs': infusion_event_log_entity_1.InfusionEventLog,
            'ward_settings': ward_setting_entity_1.WardSetting,
        };
    }
    deriveAlertCategory(alertType) {
        if (!alertType)
            return null;
        switch (alertType) {
            case 'stop':
            case 'done':
            case 'fast':
                return 'critical';
            case 'slow':
            case 'almost_done':
                return 'caution';
            case 'disconnected':
                return 'system_error';
            default:
                return null;
        }
    }
    getRepository(tableName) {
        const specialRoutes = ['monitoring', 'mqtt', 'auth', 'emr'];
        if (specialRoutes.includes(tableName)) {
            throw new common_1.HttpException(`Table ${tableName} not found or accessible`, common_1.HttpStatus.NOT_FOUND);
        }
        const entityClass = this.entityMap[tableName];
        if (!entityClass) {
            throw new common_1.HttpException(`Unknown table: ${tableName}`, common_1.HttpStatus.BAD_REQUEST);
        }
        return this.dataSource.getRepository(entityClass);
    }
    async findAll(tableName, query, authorization) {
        try {
            const repository = this.getRepository(tableName);
            const queryBuilder = repository.createQueryBuilder(tableName);
            if (query.where) {
                const whereConditions = query.where.split(',');
                whereConditions.forEach((condition, index) => {
                    const [key, value] = condition.split(':');
                    if (key && value) {
                        if (index === 0) {
                            queryBuilder.andWhere(`${tableName}.${key} = :${key}`, { [key]: value });
                        }
                        else {
                            queryBuilder.andWhere(`${tableName}.${key} = :${key}${index}`, { [`${key}${index}`]: value });
                        }
                    }
                });
            }
            if (query.search) {
                queryBuilder.andWhere(`${tableName}.name LIKE :search`, { search: `%${query.search}%` });
            }
            if (query.start_date) {
                queryBuilder.andWhere(`${tableName}.created_at >= :start_date`, { start_date: query.start_date });
            }
            if (query.end_date) {
                queryBuilder.andWhere(`${tableName}.created_at <= :end_date`, { end_date: query.end_date });
            }
            if (query.order) {
                const orderConditions = query.order.split(',');
                orderConditions.forEach((condition) => {
                    const [key, direction] = condition.split(':');
                    if (key && direction) {
                        queryBuilder.addOrderBy(`${tableName}.${key}`, direction.toUpperCase());
                    }
                });
            }
            else {
                queryBuilder.orderBy(`${tableName}.id`, 'DESC');
            }
            const limit = parseInt(query.limit) || 10;
            const page = parseInt(query.page) || 1;
            const offset = (page - 1) * limit;
            queryBuilder.skip(offset).take(limit);
            const [rawData, total] = await queryBuilder.getManyAndCount();
            let data = rawData;
            if (tableName === 'users') {
                const hospitalIds = [...new Set(rawData.map(u => u.hospital_id).filter(id => id))];
                const wardIds = [...new Set(rawData.map(u => u.ward_id).filter(id => id))];
                const userIds = rawData.map(u => u.id);
                const hospitalRepository = this.getRepository('hospitals');
                const wardRepository = this.getRepository('wards');
                const lockoutStatusRepository = this.getRepository('user_lockout_status');
                const hospitals = hospitalIds.length > 0
                    ? await hospitalRepository.findBy({ id: (0, typeorm_1.In)(hospitalIds) })
                    : [];
                const wards = wardIds.length > 0
                    ? await wardRepository.findBy({ id: (0, typeorm_1.In)(wardIds) })
                    : [];
                const lockoutStatuses = userIds.length > 0
                    ? await lockoutStatusRepository.findBy({ user_id: (0, typeorm_1.In)(userIds) })
                    : [];
                const hospitalMap = new Map(hospitals.map(h => [h.id, h]));
                const wardMap = new Map(wards.map(w => [w.id, w]));
                const lockoutMap = new Map(lockoutStatuses.map(l => [l.user_id, l]));
                data = rawData.map(user => {
                    const result = {
                        id: user.id,
                        role: user.role,
                        auth_id: user.auth_id,
                        nickname: user.nickname,
                        hospital_id: user.hospital_id,
                        ward_id: user.ward_id,
                        has_emr: user.has_emr,
                        emr_user_key: user.emr_user_key || null,
                        emr_group_code: user.emr_group_code || null,
                        emr_group_desc: user.emr_group_desc || null,
                        dept_code: user.dept_code || null,
                        employee_number: user.employee_number || null,
                        profile_image: user.profile_image || '/images/default_profile.png',
                        created_at: user.created_at,
                        updated_at: user.updated_at
                    };
                    if (user.hospital_id) {
                        const hospital = hospitalMap.get(user.hospital_id);
                        if (hospital) {
                            result.hospital_info = {
                                hospital_id: hospital.id,
                                hospital_name: hospital.name
                            };
                        }
                    }
                    if (user.ward_id) {
                        const ward = wardMap.get(user.ward_id);
                        if (ward) {
                            result.ward_info = {
                                ward_id: ward.id,
                                ward_name: ward.name
                            };
                        }
                    }
                    const lockoutStatus = lockoutMap.get(user.id);
                    result.is_locked = lockoutStatus ? lockoutStatus.is_locked : false;
                    result.failure_count = lockoutStatus ? lockoutStatus.failure_count : 0;
                    return result;
                });
            }
            if (tableName === 'patient_bed_assignments') {
                const patientIds = [...new Set(rawData.map(a => a.patient_id).filter(id => id))];
                const bedIds = [...new Set(rawData.map(a => a.bed_id).filter(id => id))];
                const patientRepository = this.getRepository('patients');
                const bedRepository = this.getRepository('beds');
                const patients = patientIds.length > 0
                    ? await patientRepository.findBy({ id: (0, typeorm_1.In)(patientIds) })
                    : [];
                const beds = bedIds.length > 0
                    ? await bedRepository.find({ where: { id: (0, typeorm_1.In)(bedIds) }, relations: ['room', 'room.ward', 'room.ward.hospital'] })
                    : [];
                const patientMap = new Map(patients.map(p => [p.id, p]));
                const bedMap = new Map(beds.map(b => [b.id, b]));
                data = rawData.map(assignment => {
                    const result = { ...assignment };
                    const patient = assignment.patient_id ? patientMap.get(assignment.patient_id) : null;
                    const bed = assignment.bed_id ? bedMap.get(assignment.bed_id) : null;
                    if (patient) {
                        result.patient_name = patient.name;
                        result.chart_number = patient.chart_number;
                        result.sex = patient.sex;
                        result.age = patient.age;
                    }
                    if (bed) {
                        result.bed_number = bed.bed_number;
                        if (bed.room) {
                            result.room_number = bed.room.name;
                            if (bed.room.ward) {
                                result.ward_name = bed.room.ward.name;
                                if (bed.room.ward.hospital) {
                                    result.hospital_name = bed.room.ward.hospital.name;
                                }
                            }
                        }
                    }
                    return result;
                });
            }
            if (tableName === 'devices') {
                const bedIds = [...new Set(rawData.map(d => d.bed_id).filter(id => id))];
                const bedRepository = this.getRepository('beds');
                const beds = bedIds.length > 0
                    ? await bedRepository.find({ where: { id: (0, typeorm_1.In)(bedIds) }, relations: ['room', 'room.ward', 'room.ward.hospital'] })
                    : [];
                const bedMap = new Map(beds.map(b => [b.id, b]));
                data = rawData.map(device => {
                    const result = { ...device };
                    if (device.bed_id) {
                        const bed = bedMap.get(device.bed_id);
                        if (bed) {
                            result.bed = bed;
                            result.bed_number = bed.bed_number;
                            if (bed.room) {
                                result.room = bed.room;
                                result.room_id = bed.room.id;
                                result.room_number = bed.room.name;
                                if (bed.room.ward) {
                                    result.ward = bed.room.ward;
                                    result.ward_id = bed.room.ward.id;
                                    result.ward_name = bed.room.ward.name;
                                    if (bed.room.ward.hospital) {
                                        result.hospital = bed.room.ward.hospital;
                                        result.hospital_id = bed.room.ward.hospital.id;
                                        result.hospital_name = bed.room.ward.hospital.name;
                                    }
                                }
                            }
                        }
                    }
                    return result;
                });
            }
            return {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        }
        catch (error) {
            this.logger.error(`Error in findAll for ${tableName}:`, error);
            throw new common_1.HttpException(error.message || 'Error fetching data', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async findOne(tableName, id, userId) {
        try {
            const repository = this.getRepository(tableName);
            const queryBuilder = repository.createQueryBuilder(tableName);
            queryBuilder.where(`${tableName}.id = :id`, { id });
            if (tableName === 'devices') {
                queryBuilder.leftJoinAndSelect(`${tableName}.bed`, 'bed');
                queryBuilder.leftJoinAndSelect('bed.room', 'room');
                queryBuilder.leftJoinAndSelect('room.ward', 'ward');
                queryBuilder.leftJoinAndSelect('ward.hospital', 'hospital');
            }
            if (userId && tableName === 'notifications') {
                queryBuilder.andWhere(`${tableName}.user_id = :userId`, { userId });
            }
            const result = await queryBuilder.getOne();
            if (!result) {
                throw new common_1.HttpException(`Record not found in ${tableName} with id ${id}`, common_1.HttpStatus.NOT_FOUND);
            }
            return result;
        }
        catch (error) {
            this.logger.error(`Error in findOne for ${tableName}:`, error);
            throw error;
        }
    }
    async update(tableName, id, updateDto) {
        try {
            this.logger.log(`[UPDATE INPUT] Table: ${tableName}, ID: ${id}, Body: ${JSON.stringify(updateDto)}`);
            const repository = this.getRepository(tableName);
            if (!updateDto || Object.keys(updateDto).length === 0) {
                throw new common_1.HttpException('Update data is required', common_1.HttpStatus.BAD_REQUEST);
            }
            const existingRecord = await repository.findOne({ where: { id } });
            if (!existingRecord) {
                throw new common_1.HttpException(`Record not found in ${tableName} with id ${id}`, common_1.HttpStatus.NOT_FOUND);
            }
            const filteredUpdateDto = { ...updateDto };
            delete filteredUpdateDto.id;
            delete filteredUpdateDto.created_at;
            delete filteredUpdateDto.updated_at;
            const isChangeButtonClicked = updateDto.infusion_current_volume === true;
            if (Object.keys(filteredUpdateDto).length === 0) {
                throw new common_1.HttpException('No valid fields to update', common_1.HttpStatus.BAD_REQUEST);
            }
            if (tableName === 'users') {
                if (filteredUpdateDto.name && !filteredUpdateDto.nickname) {
                    filteredUpdateDto.nickname = filteredUpdateDto.name;
                }
                delete filteredUpdateDto.name;
                if (filteredUpdateDto.fcm_token === '' || filteredUpdateDto.fcm_token === null) {
                    filteredUpdateDto.fcm_token = null;
                }
                if (filteredUpdateDto.fcm_token && filteredUpdateDto.fcm_token !== '') {
                    await repository.createQueryBuilder()
                        .update()
                        .set({ fcm_token: null })
                        .where('fcm_token = :token AND id != :userId', {
                        token: filteredUpdateDto.fcm_token,
                        userId: id,
                    })
                        .execute();
                }
                const allowedUserFields = [
                    'role', 'auth_id', 'password', 'nickname',
                    'hospital_id', 'ward_id', 'has_emr', 'emr_user_key',
                    'emr_group_code', 'emr_group_desc', 'dept_code',
                    'employee_number', 'profile_image', 'fcm_token',
                ];
                for (const key of Object.keys(filteredUpdateDto)) {
                    if (!allowedUserFields.includes(key)) {
                        this.logger.warn(`[USER UPDATE] Unknown field removed: ${key}`);
                        delete filteredUpdateDto[key];
                    }
                }
                if (Object.keys(filteredUpdateDto).length === 0) {
                    throw new common_1.HttpException('No valid fields to update for users', common_1.HttpStatus.BAD_REQUEST);
                }
                if (filteredUpdateDto.auth_id) {
                    const existingUser = await repository.findOne({
                        where: { auth_id: filteredUpdateDto.auth_id }
                    });
                    if (existingUser && existingUser.id !== id) {
                        throw new common_1.HttpException(`이미 사용 중인 ID입니다: ${filteredUpdateDto.auth_id}`, common_1.HttpStatus.CONFLICT);
                    }
                }
                if (filteredUpdateDto.employee_number && filteredUpdateDto.employee_number === existingRecord.employee_number) {
                    delete filteredUpdateDto.employee_number;
                }
                if (filteredUpdateDto.password) {
                    const bcrypt = require('bcrypt');
                    filteredUpdateDto.password = await bcrypt.hash(filteredUpdateDto.password, 10);
                    this.logger.log(`[USER UPDATE] Password encrypted for user ${id}`);
                }
            }
            if (tableName === 'hospitals' && filteredUpdateDto.name) {
                const normalizedName = filteredUpdateDto.name.replace(/\s+/g, '');
                const allHospitals = await repository.find();
                const duplicate = allHospitals.find(hospital => hospital.id !== id && hospital.name.replace(/\s+/g, '') === normalizedName);
                if (duplicate) {
                    throw new common_1.HttpException(`동일한 이름의 병원이 이미 존재합니다: ${duplicate.name}`, common_1.HttpStatus.CONFLICT);
                }
            }
            if (tableName === 'devices') {
                if (filteredUpdateDto.serial_number) {
                    const existingDevice = await repository.findOne({
                        where: { serial_number: filteredUpdateDto.serial_number }
                    });
                    if (existingDevice && existingDevice.id !== id) {
                        throw new common_1.HttpException(`동일한 시리얼 번호의 장치가 이미 존재합니다: ${filteredUpdateDto.serial_number}`, common_1.HttpStatus.CONFLICT);
                    }
                }
                if (filteredUpdateDto.hospital_id !== undefined) {
                    if (existingRecord.hospital_id !== filteredUpdateDto.hospital_id) {
                        if (filteredUpdateDto.ward_id === undefined) {
                            filteredUpdateDto.ward_id = null;
                        }
                        filteredUpdateDto.room_id = null;
                        this.logger.log(`[DEVICE UPDATE] Hospital changed for device ${id}, resetting location (ward_id: ${filteredUpdateDto.ward_id}, room_id: null)`);
                    }
                }
            }
            if (tableName === 'patient_bed_assignments') {
                if (filteredUpdateDto.infusion_cc_hr !== undefined) {
                    filteredUpdateDto.infusion_cchr = filteredUpdateDto.infusion_cc_hr;
                    delete filteredUpdateDto.infusion_cc_hr;
                }
                if (filteredUpdateDto.infusion_type && filteredUpdateDto.infusion_type !== existingRecord.infusion_type) {
                    try {
                        const infusionRepository = this.getRepository('infusions');
                        if (filteredUpdateDto.infusion_id) {
                            await infusionRepository.increment({ id: filteredUpdateDto.infusion_id }, 'usage_count', 1);
                            this.logger.log(`[CHANGE_INFUSION] usage_count incremented for infusion_id=${filteredUpdateDto.infusion_id}`);
                        }
                        else {
                            const infusion = await infusionRepository.findOne({ where: { name: filteredUpdateDto.infusion_type, is_active: true } });
                            if (infusion) {
                                await infusionRepository.increment({ id: infusion.id }, 'usage_count', 1);
                                this.logger.log(`[CHANGE_INFUSION] usage_count incremented for infusion name="${filteredUpdateDto.infusion_type}" (id=${infusion.id})`);
                            }
                        }
                    }
                    catch (usageError) {
                        this.logger.error(`[CHANGE_INFUSION] usage_count update failed: ${usageError.message}`);
                    }
                }
            }
            if (tableName === 'patient_bed_assignments' && filteredUpdateDto.device_id !== undefined) {
                if (existingRecord.device_id !== filteredUpdateDto.device_id) {
                    filteredUpdateDto.assigned_at = new Date();
                    filteredUpdateDto.alert_type = null;
                    filteredUpdateDto.alert_category = null;
                    this.logger.log(`[ASSIGNMENT UPDATE] Device changed for assignment ${id}: ${existingRecord.device_id} → ${filteredUpdateDto.device_id}, resetting assigned_at and clearing alerts`);
                }
            }
            if (tableName === 'rooms' && filteredUpdateDto.bed_count !== undefined) {
                const oldBedCount = existingRecord.bed_count || 0;
                const newBedCount = filteredUpdateDto.bed_count;
                if (oldBedCount !== newBedCount) {
                    this.logger.log(`[ROOM UPDATE] Room ${id} bed_count change: ${oldBedCount} -> ${newBedCount}`);
                    if (newBedCount < oldBedCount) {
                        const bedRepository = this.getRepository('beds');
                        const deleteCount = oldBedCount - newBedCount;
                        this.logger.log(`[ROOM UPDATE DEBUG] Starting bed_count decrease for room ${id}: ${oldBedCount} -> ${newBedCount}`);
                        const allBeds = await bedRepository.find({
                            where: { room_id: id },
                            order: { id: 'ASC' }
                        });
                        this.logger.log(`[ROOM UPDATE DEBUG] All beds:`, allBeds.map(b => ({ id: b.id, bed_number: b.bed_number, status: b.status })));
                        const availableBeds = allBeds
                            .filter(bed => bed.status === 'available')
                            .sort((a, b) => {
                            const aNum = parseInt(a.bed_number) || 0;
                            const bNum = parseInt(b.bed_number) || 0;
                            return bNum - aNum;
                        });
                        this.logger.log(`[ROOM UPDATE] Total beds: ${allBeds.length}, Available: ${availableBeds.length}, Need to delete: ${deleteCount}`);
                        if (availableBeds.length < deleteCount) {
                            throw new common_1.HttpException('사용 중인 병상이 있습니다. 투여 완료 처리 후 다시 시도해주세요', common_1.HttpStatus.CONFLICT);
                        }
                        const bedsToDelete = availableBeds.slice(0, deleteCount);
                        const deviceRepository = this.getRepository('devices');
                        for (const bed of bedsToDelete) {
                            const connectedDevice = await deviceRepository.findOne({
                                where: { bed_id: bed.id }
                            });
                            if (connectedDevice) {
                                throw new common_1.HttpException('해당 병실에 연결된 기기를 제거 후 다시 시도해주세요', common_1.HttpStatus.CONFLICT);
                            }
                        }
                        const assignmentRepository = this.getRepository('patient_bed_assignments');
                        for (const bed of bedsToDelete) {
                            await assignmentRepository.update({ bed_id: bed.id }, { bed_id: null });
                        }
                        await bedRepository.remove(bedsToDelete);
                        this.logger.log(`[ROOM UPDATE] Deleted ${bedsToDelete.length} beds`);
                        const remainingBeds = allBeds.filter(bed => !bedsToDelete.find(deletedBed => deletedBed.id === bed.id));
                        this.logger.log(`[ROOM UPDATE DEBUG] Remaining beds before renumber:`, remainingBeds.map(b => ({ id: b.id, bed_number: b.bed_number })));
                        for (let i = 0; i < remainingBeds.length; i++) {
                            const oldNumber = remainingBeds[i].bed_number;
                            remainingBeds[i].bed_number = String(i + 1);
                            this.logger.log(`[ROOM UPDATE DEBUG] Renumbering bed ${remainingBeds[i].id}: ${oldNumber} -> ${i + 1}`);
                            await bedRepository.save(remainingBeds[i]);
                        }
                        this.logger.log(`[ROOM UPDATE] Renumbered ${remainingBeds.length} remaining beds`);
                    }
                }
            }
            this.logger.log(`[UPDATE] Table: ${tableName}, ID: ${id}, Data: ${JSON.stringify(filteredUpdateDto)}`);
            await repository.update(id, filteredUpdateDto);
            if (tableName === 'rooms' && filteredUpdateDto.bed_count !== undefined) {
                const oldBedCount = existingRecord.bed_count || 0;
                const newBedCount = filteredUpdateDto.bed_count;
                if (newBedCount > oldBedCount) {
                    const bedRepository = this.getRepository('beds');
                    const bedsToCreate = [];
                    for (let i = oldBedCount + 1; i <= newBedCount; i++) {
                        bedsToCreate.push({
                            room_id: id,
                            bed_number: String(i),
                            status: 'available',
                        });
                    }
                    await bedRepository.save(bedsToCreate);
                    this.logger.log(`[ROOM UPDATE] Added ${bedsToCreate.length} new beds (${oldBedCount + 1} to ${newBedCount})`);
                }
            }
            const updatedRecord = await repository.findOne({ where: { id } });
            if (tableName === 'patient_bed_assignments' && updatedRecord) {
                const isResetRequested = updateDto.infusion_current_volume == 0;
                if (updatedRecord.device_id && updatedRecord.infusion_total_volume) {
                    try {
                        const deviceRepository = this.getRepository('devices');
                        const targetDevice = await deviceRepository.findOne({ where: { id: updatedRecord.device_id } });
                        if (targetDevice && targetDevice.serial_number) {
                            this.mqttService.sendDeviceSetting(targetDevice.serial_number, {
                                totalVolume: updatedRecord.infusion_total_volume,
                                flowRate: updatedRecord.infusion_cchr || 0,
                                infusion_current_volume: isResetRequested ? 0 : undefined
                            });
                            this.logger.log(`[TEST]2 기기(${targetDevice.serial_number}) 수액교체여부 확인 : ${isResetRequested}`);
                            this.logger.log(`[ASSIGNMENT UPDATE] 기기(${targetDevice.serial_number})로 전송 완료! (총 용량: ${updatedRecord.infusion_total_volume}ml, 처방 속도: ${updatedRecord.infusion_cchr || 0}cc/hr) 누적투여용량 : ${updatedRecord.infusion_current_volume}`);
                        }
                    }
                    catch (e) {
                        this.logger.error(`[ASSIGNMENT UPDATE] 기기 설정 전송 실패: ${e.message}`);
                    }
                }
                if (updatedRecord.device_id && updatedRecord.bed_id) {
                    try {
                        const deviceRepository = this.getRepository('devices');
                        const bedRepository = this.getRepository('beds');
                        const bed = await bedRepository.findOne({
                            where: { id: updatedRecord.bed_id },
                            relations: ['room', 'room.ward']
                        });
                        if (bed?.room?.ward) {
                            await deviceRepository.update(updatedRecord.device_id, {
                                bed_id: updatedRecord.bed_id,
                                room_id: bed.room.id,
                                ward_id: bed.room.ward.id,
                                hospital_id: bed.room.ward.hospital_id,
                                last_udpate_at: new Date(),
                            });
                            this.logger.log(`[ASSIGNMENT UPDATE] Updated device ${updatedRecord.device_id} location - bed_id: ${updatedRecord.bed_id}, room_id: ${bed.room.id}`);
                        }
                        if (existingRecord.device_id && existingRecord.device_id !== updatedRecord.device_id) {
                            await deviceRepository.update(existingRecord.device_id, {
                                bed_id: null,
                                room_id: null,
                                last_udpate_at: new Date(),
                            });
                            this.logger.log(`[ASSIGNMENT UPDATE] Cleared old device ${existingRecord.device_id} location (device changed to ${updatedRecord.device_id})`);
                        }
                    }
                    catch (deviceError) {
                        this.logger.error(`[ASSIGNMENT UPDATE] Device location update failed: ${deviceError.message}`);
                    }
                }
                else if (!updatedRecord.device_id && existingRecord.device_id) {
                    try {
                        const deviceRepository = this.getRepository('devices');
                        await deviceRepository.update(existingRecord.device_id, {
                            bed_id: null,
                            room_id: null,
                            last_udpate_at: new Date(),
                        });
                        this.logger.log(`[ASSIGNMENT UPDATE] Cleared device ${existingRecord.device_id} location (device disconnected)`);
                    }
                    catch (deviceError) {
                        this.logger.error(`[ASSIGNMENT UPDATE] Device location clear failed: ${deviceError.message}`);
                    }
                }
                try {
                    const bedId = updatedRecord.bed_id || existingRecord.bed_id;
                    if (bedId) {
                        const bedRepository = this.getRepository('beds');
                        const bed = await bedRepository.findOne({
                            where: { id: bedId },
                            relations: ['room', 'room.ward']
                        });
                        if (bed?.room?.ward?.hospital_id) {
                            await this.sendAssignmentRefreshNotification(bed.room.ward.hospital_id, {
                                assignment_id: id,
                                bed_id: bedId,
                                action: 'update'
                            });
                        }
                    }
                }
                catch (mqttError) {
                    this.logger.error(`[ASSIGNMENT UPDATE] MQTT notification failed: ${mqttError.message}`);
                }
            }
            return updatedRecord;
        }
        catch (error) {
            this.logger.error(`Error in update for ${tableName}:`, error);
            throw error;
        }
    }
    async sendFcmTest(userId, title, body) {
        const userRepo = this.getRepository('users');
        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) {
            return { success: false, message: '유저를 찾을 수 없습니다.' };
        }
        if (!user.fcm_token) {
            return { success: false, message: '해당 유저에 FCM 토큰이 없습니다.' };
        }
        const result = await this.fcmService.sendPush(user.fcm_token, title, body, {
            alert_category: 'system_error',
            alert_type: 'test',
        });
        return { success: result, fcm_token: user.fcm_token.substring(0, 20) + '...' };
    }
    async markAllNotificationsAsRead(userId) {
        const repository = this.getRepository('notifications');
        const result = await repository
            .createQueryBuilder()
            .update(notification_entity_1.Notification)
            .set({ is_read: 1 })
            .where('user_id = :userId AND is_read = 0', { userId })
            .execute();
        return { updated: result.affected || 0 };
    }
    async remove(tableName, id) {
        try {
            const repository = this.getRepository(tableName);
            const existingRecord = await repository.findOne({ where: { id } });
            if (!existingRecord) {
                throw new common_1.HttpException(`Record not found in ${tableName} with id ${id}`, common_1.HttpStatus.NOT_FOUND);
            }
            if (tableName === 'devices') {
                if (existingRecord.bed_id !== null) {
                    throw new common_1.HttpException(`기기(ID: ${id})를 삭제할 수 없습니다. 현재 침상(bed_id: ${existingRecord.bed_id})에 연결되어 있습니다. 먼저 기기 연결을 해제해주세요.`, common_1.HttpStatus.CONFLICT);
                }
            }
            if (tableName === 'hospitals') {
                const userRepository = this.getRepository('users');
                const hospitalUsers = await userRepository
                    .createQueryBuilder('user')
                    .where('user.hospital_id = :hospitalId', { hospitalId: id })
                    .andWhere('user.role IN (:...roles)', { roles: ['admin', 'nurse'] })
                    .getMany();
                if (hospitalUsers.length > 0) {
                    throw new common_1.HttpException(`해당 병원의 병원 관리자 및 간호사 계정을 먼저 삭제하고 다시 시도해주세요.`, common_1.HttpStatus.CONFLICT);
                }
                const wardRepository = this.getRepository('wards');
                const roomRepository = this.getRepository('rooms');
                const bedRepository = this.getRepository('beds');
                const assignmentRepository = this.getRepository('patient_bed_assignments');
                const wards = await wardRepository.find({ where: { hospital_id: id } });
                const wardIds = wards.map(ward => ward.id);
                if (wardIds.length > 0) {
                    const rooms = await roomRepository
                        .createQueryBuilder('room')
                        .where('room.ward_id IN (:...wardIds)', { wardIds })
                        .getMany();
                    const roomIds = rooms.map(room => room.id);
                    if (roomIds.length > 0) {
                        const beds = await bedRepository
                            .createQueryBuilder('bed')
                            .where('bed.room_id IN (:...roomIds)', { roomIds })
                            .getMany();
                        const bedIds = beds.map(bed => bed.id);
                        if (bedIds.length > 0) {
                            const activeAssignments = await assignmentRepository
                                .createQueryBuilder('assignment')
                                .where('assignment.bed_id IN (:...bedIds)', { bedIds })
                                .andWhere('assignment.released_at IS NULL')
                                .getMany();
                            if (activeAssignments.length > 0) {
                                throw new common_1.HttpException(`해당 병원에 투여 중인 병상이 있습니다. 투여 완료 처리 후 다시 시도해주세요.`, common_1.HttpStatus.CONFLICT);
                            }
                        }
                    }
                }
                await wardRepository.update({ hospital_id: id }, { hospital_id: null });
                const deviceRepository = this.getRepository('devices');
                await deviceRepository.update({ hospital_id: id }, { hospital_id: null });
            }
            else if (tableName === 'wards') {
                const userRepository = this.getRepository('users');
                const wardNurses = await userRepository
                    .createQueryBuilder('user')
                    .where('user.ward_id = :wardId', { wardId: id })
                    .andWhere('user.role = :role', { role: 'nurse' })
                    .getMany();
                if (wardNurses.length > 0) {
                    throw new common_1.HttpException(`해당 병동 간호사 계정을 먼저 삭제하고 다시 시도해주세요.`, common_1.HttpStatus.CONFLICT);
                }
                const roomRepository = this.getRepository('rooms');
                const bedRepository = this.getRepository('beds');
                const assignmentRepository = this.getRepository('patient_bed_assignments');
                const rooms = await roomRepository.find({ where: { ward_id: id } });
                const roomIds = rooms.map(room => room.id);
                if (roomIds.length > 0) {
                    const beds = await bedRepository
                        .createQueryBuilder('bed')
                        .where('bed.room_id IN (:...roomIds)', { roomIds })
                        .getMany();
                    const bedIds = beds.map(bed => bed.id);
                    if (bedIds.length > 0) {
                        const activeAssignments = await assignmentRepository
                            .createQueryBuilder('assignment')
                            .where('assignment.bed_id IN (:...bedIds)', { bedIds })
                            .andWhere('assignment.released_at IS NULL')
                            .getMany();
                        if (activeAssignments.length > 0) {
                            throw new common_1.HttpException(`해당 병동에 투여 중인 병상이 있습니다. 투여 완료 처리 후 다시 삭제해주세요.`, common_1.HttpStatus.CONFLICT);
                        }
                    }
                }
                await roomRepository.update({ ward_id: id }, { ward_id: null });
                const deviceRepository = this.getRepository('devices');
                await deviceRepository.update({ ward_id: id }, { ward_id: null });
            }
            else if (tableName === 'rooms') {
                const bedRepository = this.getRepository('beds');
                const assignmentRepository = this.getRepository('patient_bed_assignments');
                const beds = await bedRepository.find({ where: { room_id: id } });
                const bedIds = beds.map(bed => bed.id);
                if (bedIds.length > 0) {
                    const activeAssignments = await assignmentRepository
                        .createQueryBuilder('assignment')
                        .where('assignment.bed_id IN (:...bedIds)', { bedIds })
                        .andWhere('assignment.released_at IS NULL')
                        .getMany();
                    if (activeAssignments.length > 0) {
                        throw new common_1.HttpException(`해당 병실에 투여 중인 병상이 있습니다. 투여 완료 처리 후 다시 삭제해주세요.`, common_1.HttpStatus.CONFLICT);
                    }
                }
                await bedRepository.update({ room_id: id }, { room_id: null });
                const deviceRepository = this.getRepository('devices');
                await deviceRepository.update({ room_id: id }, { room_id: null });
            }
            else if (tableName === 'beds') {
                const assignmentRepository = this.getRepository('patient_bed_assignments');
                const activeAssignments = await assignmentRepository.find({
                    where: { bed_id: id, released_at: (0, typeorm_1.IsNull)() }
                });
                if (activeAssignments.length > 0) {
                    throw new common_1.HttpException(`사용 중인 병상입니다. 투여 완료 처리 후 다시 삭제해주세요.`, common_1.HttpStatus.CONFLICT);
                }
                await assignmentRepository.update({ bed_id: id }, { bed_id: null });
                const deviceRepository = this.getRepository('devices');
                await deviceRepository.update({ bed_id: id }, { bed_id: null });
            }
            else if (tableName === 'patients') {
                const assignmentRepository = this.getRepository('patient_bed_assignments');
                await assignmentRepository.update({ patient_id: id }, { patient_id: null });
            }
            else if (tableName === 'devices') {
                const assignmentRepository = this.getRepository('patient_bed_assignments');
                await assignmentRepository.update({ device_id: id }, { device_id: null });
                const notificationRepository = this.getRepository('notifications');
                await notificationRepository.update({ device_id: id }, { device_id: null });
            }
            else if (tableName === 'patient_bed_assignments') {
                const notificationRepository = this.getRepository('notifications');
                await notificationRepository.update({ patient_bed_assignment_id: id }, { patient_bed_assignment_id: null });
            }
            else if (tableName === 'users') {
                const userRepository = this.getRepository('users');
                const userToDelete = await userRepository.findOne({ where: { id } });
                if (userToDelete && userToDelete.role === 'admin' && userToDelete.hospital_id) {
                    const nurseCount = await userRepository.count({
                        where: {
                            hospital_id: userToDelete.hospital_id,
                            role: 'nurse'
                        }
                    });
                    if (nurseCount > 0) {
                        throw new common_1.HttpException(`해당 병원에 소속된 간호사가 ${nurseCount}명 존재합니다. 관리자를 삭제하려면 먼저 모든 간호사를 삭제해주세요.`, common_1.HttpStatus.BAD_REQUEST);
                    }
                }
                const notificationRepository = this.getRepository('notifications');
                await notificationRepository.update({ user_id: id }, { user_id: null });
                const lockoutLogRepository = this.getRepository('user_lockout_log');
                await lockoutLogRepository.update({ user_id: id }, { user_id: null });
                const userSettingRepository = this.getRepository('user_settings');
                await userSettingRepository.delete({ user_id: id });
                const accessTokenRepository = this.getRepository('access_tokens');
                await accessTokenRepository.delete({ user_id: id });
                const lockoutStatusRepository = this.getRepository('user_lockout_status');
                await lockoutStatusRepository.delete({ user_id: id });
                this.logger.log(`[USER DELETE] Deleted user-specific data and unlinked foreign keys for user ${id}`);
            }
            let assignmentHospitalId = null;
            if (tableName === 'patient_bed_assignments' && existingRecord.bed_id) {
                try {
                    const bedRepository = this.getRepository('beds');
                    const bed = await bedRepository.findOne({
                        where: { id: existingRecord.bed_id },
                        relations: ['room', 'room.ward']
                    });
                    assignmentHospitalId = bed?.room?.ward?.hospital_id || null;
                }
                catch (e) {
                    this.logger.error(`[ASSIGNMENT DELETE] Failed to lookup hospital_id: ${e.message}`);
                }
            }
            await repository.delete(id);
            if (tableName === 'patient_bed_assignments' && assignmentHospitalId) {
                try {
                    await this.sendAssignmentRefreshNotification(assignmentHospitalId, {
                        assignment_id: id,
                        bed_id: existingRecord.bed_id,
                        action: 'delete'
                    });
                }
                catch (mqttError) {
                    this.logger.error(`[ASSIGNMENT DELETE] MQTT notification failed: ${mqttError.message}`);
                }
            }
            return { message: `Record with id ${id} deleted successfully from ${tableName}. Related foreign keys have been set to null.` };
        }
        catch (error) {
            this.logger.error(`Error in remove for ${tableName}:`, error);
            throw error;
        }
    }
    async insertData(tableName, data) {
        try {
            const repository = this.getRepository(tableName);
            switch (tableName) {
                case 'users':
                    if (data.auth_id) {
                        const existingUser = await repository.findOne({
                            where: { auth_id: data.auth_id }
                        });
                        if (existingUser) {
                            throw new common_1.HttpException(`이미 사용 중인 ID입니다: ${data.auth_id}`, common_1.HttpStatus.CONFLICT);
                        }
                    }
                    if (data.role === 'admin' && data.hospital_id) {
                        const existingAdmin = await repository.findOne({
                            where: {
                                hospital_id: data.hospital_id,
                                role: 'admin'
                            }
                        });
                        if (existingAdmin) {
                            throw new common_1.HttpException(`해당 병원에는 이미 관리자가 존재합니다`, common_1.HttpStatus.CONFLICT);
                        }
                    }
                    if (data.password) {
                        const bcrypt = require('bcrypt');
                        data.password = await bcrypt.hash(data.password, 10);
                    }
                    break;
                case 'hospitals':
                    if (data.name) {
                        const normalizedName = data.name.replace(/\s+/g, '');
                        const allHospitals = await repository.find();
                        const duplicate = allHospitals.find(hospital => hospital.name.replace(/\s+/g, '') === normalizedName);
                        if (duplicate) {
                            throw new common_1.HttpException(`동일한 이름의 병원이 이미 존재합니다: ${duplicate.name}`, common_1.HttpStatus.CONFLICT);
                        }
                    }
                    break;
                case 'devices':
                    if (data.serial_number) {
                        const existingDevice = await repository.findOne({
                            where: { serial_number: data.serial_number }
                        });
                        if (existingDevice) {
                            throw new common_1.HttpException(`동일한 시리얼 번호의 장치가 이미 존재합니다: ${data.serial_number}`, common_1.HttpStatus.CONFLICT);
                        }
                    }
                    break;
                case 'patient_bed_assignments':
                    if (data.patient_id && data.bed_id && data.device_id) {
                        const existingAssignment = await repository.findOne({
                            where: {
                                patient_id: data.patient_id,
                                bed_id: data.bed_id,
                                released_at: (0, typeorm_1.IsNull)(),
                                device_id: (0, typeorm_1.IsNull)(),
                            },
                            order: { id: 'DESC' },
                        });
                        if (existingAssignment) {
                            const mergeData = { device_id: data.device_id };
                            if (data.infusion_type)
                                mergeData.infusion_type = data.infusion_type;
                            if (data.infusion_code)
                                mergeData.infusion_code = data.infusion_code;
                            if (data.infusion_total_volume)
                                mergeData.infusion_total_volume = data.infusion_total_volume;
                            if (data.infusion_cchr !== undefined) {
                                mergeData.infusion_cchr = data.infusion_cchr;
                            }
                            else if (data.infusion_gtt !== undefined) {
                                mergeData.infusion_cchr = Math.round(data.infusion_gtt * 3.282 * 100) / 100;
                            }
                            await repository.update(existingAssignment.id, mergeData);
                            this.logger.log(`[ASSIGNMENT MERGE] Updated existing assignment ${existingAssignment.id} with device_id=${data.device_id} instead of creating new one`);
                            const merged = await repository.findOne({ where: { id: existingAssignment.id } });
                            if (merged.device_id) {
                                const deviceRepository = this.getRepository('devices');
                                const bedRepository = this.getRepository('beds');
                                const bed = await bedRepository.findOne({
                                    where: { id: merged.bed_id },
                                    relations: ['room', 'room.ward']
                                });
                                if (bed?.room?.ward) {
                                    await deviceRepository.update(merged.device_id, {
                                        bed_id: merged.bed_id,
                                        room_id: bed.room.id,
                                        ward_id: bed.room.ward.id,
                                        hospital_id: bed.room.ward.hospital_id,
                                        last_udpate_at: new Date(),
                                    });
                                    this.logger.log(`[ASSIGNMENT MERGE] Updated device ${merged.device_id} location`);
                                }
                            }
                            return merged;
                        }
                    }
                    break;
                case 'infusion_raw_logs':
                    if (!data.api) {
                        data.api = data.device_type === 'LOAD_CELL' ? 'v2' : 'v1';
                        this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] api not provided, using default: ${data.api}`);
                    }
                    this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] Entered case - device_type: ${data.device_type}, sn: ${data.sn}, time: ${data.time}, weight: ${data.weight}`);
                    if (data.device_type === 'LOAD_CELL' && data.sn && data.time !== undefined && data.weight !== undefined) {
                        const twoMinutesAgo = new Date(Date.now() - 120000);
                        const recentLog = await repository
                            .createQueryBuilder('log')
                            .where('log.sn = :sn', { sn: data.sn })
                            .andWhere('log.created_at >= :twoMinutesAgo', { twoMinutesAgo })
                            .orderBy('log.created_at', 'DESC')
                            .getOne();
                        if (recentLog && recentLog.time !== undefined && recentLog.weight !== undefined) {
                            const timeDiff = data.time - recentLog.time;
                            const weightDiff = recentLog.weight - data.weight;
                            if (timeDiff < 5000) {
                                this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] LOAD_CELL SN ${data.sn}: Time interval too short (${timeDiff}ms < 5s), cchr not calculated`);
                            }
                            else if (timeDiff > 0 && weightDiff >= 0) {
                                const flowRate = (weightDiff * 3600000) / timeDiff;
                                if (flowRate >= 0 && flowRate <= 9999) {
                                    data.cchr = Math.round(flowRate * 100) / 100;
                                    this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] Calculated cchr for LOAD_CELL SN ${data.sn}: ${data.cchr} cc/hr (weightDiff: ${weightDiff}g, timeDiff: ${timeDiff}ms, flowRate: ${flowRate.toFixed(2)} ml/hr)`);
                                }
                                else {
                                    this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] LOAD_CELL SN ${data.sn}: Calculated cchr out of range (${flowRate.toFixed(2)} cc/hr), cchr not saved`);
                                }
                            }
                            else {
                                this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] LOAD_CELL SN ${data.sn}: Invalid diff values (timeDiff: ${timeDiff}, weightDiff: ${weightDiff}), cchr not calculated`);
                            }
                        }
                        else {
                            this.logger.log(`[INFUSION_RAW_LOG PREPROCESS] LOAD_CELL SN ${data.sn}: No recent log found within 2 minutes, cchr not calculated`);
                        }
                    }
                    break;
            }
            const entity = repository.create(data);
            const saved = await repository.save(entity);
            switch (tableName) {
                case 'infusion_raw_logs':
                    await this.processInfusionRawLog(saved);
                    break;
                case 'notifications':
                    const topic = `user/${saved.user_id}/notification`;
                    let bedId = null;
                    if (saved.patient_bed_assignment_id) {
                        const assignmentRepository = this.getRepository('patient_bed_assignments');
                        const assignment = await assignmentRepository.findOne({
                            where: { id: saved.patient_bed_assignment_id }
                        });
                        if (assignment) {
                            bedId = assignment.bed_id;
                        }
                    }
                    const payload = {
                        notification_id: saved.id,
                        user_id: saved.user_id,
                        patient_bed_assignment_id: saved.patient_bed_assignment_id,
                        bed_id: bedId,
                        device_id: saved.device_id,
                        title: saved.title,
                        message: saved.message,
                        type: saved.type,
                        is_read: saved.is_read,
                        created_at: saved.created_at,
                    };
                    this.mqttService.publishMessage(topic, payload);
                    this.logger.log(`[NOTIFICATION] Sent MQTT notification to user ${saved.user_id}, topic: ${topic}, bed_id: ${bedId}`);
                    break;
                case 'users':
                    const userSettingRepository = this.getRepository('user_settings');
                    const userSetting = userSettingRepository.create({
                        user_id: saved.id,
                        alert_color: '#009EE6',
                        alert_display_time: 5,
                        critical_sound_volume: 100,
                        caution_sound_volume: 100,
                        system_error_sound_volume: 100,
                    });
                    await userSettingRepository.save(userSetting);
                    this.logger.log(`[USER_SETTINGS CREATE] Created user settings for user ${saved.id}`);
                    break;
                case 'wards':
                    const wardSettingRepository = this.getRepository('ward_settings');
                    const wardSetting = wardSettingRepository.create({
                        ward_id: saved.id,
                    });
                    await wardSettingRepository.save(wardSetting);
                    this.logger.log(`[WARD_SETTINGS CREATE] Created ward settings for ward ${saved.id}`);
                    break;
                case 'rooms':
                    if (saved.bed_count && saved.bed_count > 0) {
                        const bedRepository = this.getRepository('beds');
                        const bedsToCreate = [];
                        for (let i = 1; i <= saved.bed_count; i++) {
                            bedsToCreate.push({
                                room_id: saved.id,
                                bed_number: String(i),
                                status: 'available',
                            });
                        }
                        await bedRepository.save(bedsToCreate);
                        this.logger.log(`Created ${saved.bed_count} beds for room ${saved.id}`);
                    }
                    break;
                case 'patient_bed_assignments':
                    if (saved.device_id) {
                        const deviceRepository = this.getRepository('devices');
                        const bedRepository = this.getRepository('beds');
                        const bed = await bedRepository.findOne({
                            where: { id: saved.bed_id },
                            relations: ['room', 'room.ward']
                        });
                        if (bed?.room?.ward) {
                            await deviceRepository.update(saved.device_id, {
                                bed_id: saved.bed_id,
                                room_id: bed.room.id,
                                ward_id: bed.room.ward.id,
                                hospital_id: bed.room.ward.hospital_id,
                                last_udpate_at: new Date(),
                            });
                            this.logger.log(`[ASSIGNMENT] Updated device ${saved.device_id} - bed_id: ${saved.bed_id}, room_id: ${bed.room.id}, ward_id: ${bed.room.ward.id}, hospital_id: ${bed.room.ward.hospital_id}`);
                        }
                        else {
                            await deviceRepository.update(saved.device_id, {
                                bed_id: saved.bed_id,
                                last_udpate_at: new Date(),
                            });
                            this.logger.log(`[ASSIGNMENT] Updated device ${saved.device_id} - bed_id: ${saved.bed_id} (no bed hierarchy found)`);
                        }
                    }
                    if (saved.bed_id) {
                        const bedRepository = this.getRepository('beds');
                        await bedRepository.update(saved.bed_id, { status: 'occupied' });
                        this.logger.log(`[ASSIGNMENT] Updated bed ${saved.bed_id} status to occupied`);
                    }
                    if (saved.bed_id) {
                        try {
                            const bedRepoMqtt = this.getRepository('beds');
                            const bedForMqtt = await bedRepoMqtt.findOne({
                                where: { id: saved.bed_id },
                                relations: ['room', 'room.ward']
                            });
                            if (bedForMqtt?.room?.ward?.hospital_id) {
                                await this.sendAssignmentRefreshNotification(bedForMqtt.room.ward.hospital_id, {
                                    assignment_id: saved.id,
                                    bed_id: saved.bed_id,
                                    patient_id: saved.patient_id,
                                    action: 'create'
                                });
                            }
                        }
                        catch (mqttError) {
                            this.logger.error(`[ASSIGNMENT INSERT] MQTT notification failed: ${mqttError.message}`);
                        }
                    }
                    break;
                default:
                    break;
            }
            const result = await repository.findOne({ where: { id: saved.id } });
            if (tableName === 'infusion_raw_logs' && result) {
                try {
                    const deviceRepository = this.getRepository('devices');
                    const device = await deviceRepository.findOne({
                        where: { serial_number: result.sn }
                    });
                    if (device && device.bed_id) {
                        const assignmentRepository = this.getRepository('patient_bed_assignments');
                        const assignment = await assignmentRepository.findOne({
                            where: {
                                device_id: device.id,
                                bed_id: device.bed_id,
                                released_at: (0, typeorm_1.IsNull)(),
                            }
                        });
                        if (assignment) {
                            const isResetNeeded = assignment.infusion_current_volume === 0;
                            return {
                                ...result,
                                r_volume_max: assignment.infusion_total_volume,
                                ordered_gtt: assignment.infusion_cchr,
                                infusion_current_volume: isResetNeeded ? 0 : undefined
                            };
                        }
                    }
                }
                catch (error) {
                    this.logger.warn(`[INSERT DATA] Failed to get r_volume_max: ${error.message}`);
                }
            }
            return result;
        }
        catch (error) {
            this.logger.error(`Error in insertData for ${tableName}:`, error);
            throw new common_1.HttpException(error.message || 'Error inserting data', error.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAllHospitalsHierarchy() {
        try {
            const hospitalRepository = this.getRepository('hospitals');
            const hospitals = await hospitalRepository.find();
            if (hospitals.length === 0) {
                return [];
            }
            const wardRepository = this.getRepository('wards');
            const allWards = await wardRepository.find();
            const roomRepository = this.getRepository('rooms');
            const allRooms = await roomRepository.find();
            const bedRepository = this.getRepository('beds');
            const allBeds = await bedRepository.find();
            const result = hospitals.map(hospital => {
                const wards = allWards.filter(w => w.hospital_id === hospital.id);
                const wardsWithRooms = wards.map(ward => {
                    const rooms = allRooms.filter(r => r.ward_id === ward.id);
                    const roomsWithBeds = rooms.map(room => {
                        const beds = allBeds.filter(b => b.room_id === room.id);
                        return {
                            ...room,
                            beds
                        };
                    });
                    return {
                        ...ward,
                        rooms: roomsWithBeds
                    };
                });
                return {
                    ...hospital,
                    wards: wardsWithRooms
                };
            });
            return result;
        }
        catch (error) {
            this.logger.error('Error in getAllHospitalsHierarchy:', error);
            throw error;
        }
    }
    async processInfusionRawLog(rawLog) {
        try {
            this.logger.log(`[PROCESS START] device_type: ${rawLog.device_type}, api: ${rawLog.api}, SN: ${rawLog.sn}`);
            if (rawLog.api === 'v4') {
                this.logger.log(`[SKIP] Skipping processing - api: ${rawLog.api}`);
                return;
            }
            this.logger.log(`[STEP 1] Searching device with SN: ${rawLog.sn}`);
            const deviceRepository = this.getRepository('devices');
            const device = await deviceRepository.findOne({
                where: { serial_number: rawLog.sn }
            });
            if (!device) {
                this.logger.warn(`[STEP 1] Device NOT found for serial_number: ${rawLog.sn}`);
                return;
            }
            this.logger.log(`[STEP 2] Searching patient_bed_assignments with device_id: ${device.id}, bed_id: ${device.bed_id}`);
            const assignmentRepository = this.getRepository('patient_bed_assignments');
            const assignment = await assignmentRepository.findOne({
                where: {
                    device_id: device.id,
                    bed_id: device.bed_id,
                    released_at: (0, typeorm_1.IsNull)(),
                },
                relations: ['patient', 'bed', 'device'],
            });
            if (!assignment) {
                this.logger.warn(`[STEP 2] No active patient bed assignment found for device_id: ${device.id}, bed_id: ${device.bed_id}`);
                return;
            }
            this.logger.log(`[STEP 4] Updating device battery and network status...`);
            await deviceRepository.update(device.id, {
                battery_percent: rawLog.battery,
                network_status: 'online',
                last_udpate_at: new Date(),
            });
            if (assignment.alert_type === 'disconnected') {
                this.logger.log(`[STEP 4.5] Assignment ${assignment.id} was disconnected, restoring connection...`);
                await assignmentRepository.update(assignment.id, {
                    alert_type: null
                });
                this.logger.log(`[STEP 4.5] Assignment ${assignment.id} alert_type set to null (reconnected)`);
                const topic = `bed/${assignment.bed_id}/assignment/update`;
                const payload = {
                    bed_id: assignment.bed_id,
                    assignment_id: assignment.id,
                    patient_id: assignment.patient_id,
                    alert_type: null,
                    updated_at: new Date().toISOString()
                };
                this.mqttService.publishMessage(topic, payload);
                this.logger.log(`[STEP 4.5] Published MQTT to ${topic}, alert_type: null (reconnected)`);
            }
            if (rawLog.device_type === 'IR') {
                this.logger.log(`[POST-PROCESS] Processing IR device data...`);
                await this.processIRDeviceData(rawLog, assignment, device);
            }
            else if (rawLog.device_type === 'LOAD_CELL') {
                this.logger.log(`[POST-PROCESS] Processing LOAD_CELL device data...`);
                await this.processLoadCellDeviceData(rawLog, assignment, device);
            }
        }
        catch (error) {
            this.logger.error(`[ERROR] Failed to process infusion raw log: ${error.message}`);
            this.logger.error(error.stack);
        }
    }
    async processIRDeviceData(rawLog, assignment, device) {
        try {
            this.logger.log(`[IR POST-PROCESS] Starting IR device post-processing...`);
            const assignmentRepository = this.getRepository('patient_bed_assignments');
            const bedRepository = this.getRepository('beds');
            const bed = await bedRepository.findOne({
                where: { id: assignment.bed_id },
                relations: ['room', 'room.ward', 'room.ward.hospital']
            });
            if (!bed || !bed.room || !bed.room.ward) {
                this.logger.warn(`[IR POST-PROCESS] Bed hierarchy not found for bed_id: ${assignment.bed_id}`);
                return;
            }
            const hospitalId = bed.room.ward.hospital_id;
            const room = bed.room;
            const wardId = bed.room.ward.id;
            const wardSettingRepository = this.getRepository('ward_settings');
            const wardSettings = await wardSettingRepository.findOne({
                where: { ward_id: wardId }
            });
            if (!wardSettings) {
                this.logger.warn(`[IR POST-PROCESS] No ward_settings found for ward ${wardId}`);
                return;
            }
            const newCurrentVolume = rawLog.injected_amount || 0;
            const infusion_percentage = assignment.infusion_total_volume > 0
                ? (newCurrentVolume / assignment.infusion_total_volume) * 100
                : 0;
            let alertType = null;
            const assignedAt = new Date(assignment.assigned_at);
            const now = new Date();
            const timeDiffMinutes = (now.getTime() - assignedAt.getTime()) / (1000 * 60);
            let shouldCheckAlerts = true;
            if (timeDiffMinutes < 2) {
                this.logger.log(`[IR POST-PROCESS] Skipping alert check - less than 2 minutes since assigned_at (${timeDiffMinutes.toFixed(1)}/2.0 minutes)`);
                shouldCheckAlerts = false;
            }
            if (!assignment.infusion_cchr || assignment.infusion_cchr === 0) {
                this.logger.log(`[IR POST-PROCESS] Skipping alert check - infusion_cchr is 0 or null`);
                shouldCheckAlerts = false;
            }
            if (shouldCheckAlerts) {
                if (infusion_percentage >= 100) {
                    alertType = 'done';
                }
                else if (infusion_percentage >= wardSettings.complete_threshold) {
                    alertType = 'almost_done';
                }
                else if (rawLog.cchr === 0) {
                    this.logger.log(`[IR POST-PROCESS] cchr=0 detected for assignment ${assignment.id}, setting alert_type to stop`);
                    alertType = 'stop';
                }
                else {
                    const fastThreshold = assignment.infusion_cchr * (1 + wardSettings.fast_threshold / 100);
                    const slowThreshold = assignment.infusion_cchr * (1 - Math.abs(wardSettings.slow_threshold) / 100);
                    if (rawLog.cchr > fastThreshold) {
                        alertType = 'fast';
                    }
                    else if (rawLog.cchr < slowThreshold && rawLog.cchr > 0) {
                        alertType = 'slow';
                    }
                }
            }
            const alertCategory = this.deriveAlertCategory(alertType);
            const updateData = {
                infusion_current_volume: newCurrentVolume,
                alert_type: alertType,
                alert_category: alertCategory,
            };
            this.logger.log(`[IR POST-PROCESS] Updating assignment ${assignment.id} - alert_type: ${alertType}, infusion_current_volume: ${newCurrentVolume}, infusion_percentage: ${infusion_percentage.toFixed(2)}%`);
            await assignmentRepository.update(assignment.id, updateData);
            this.logger.log(`[IR POST-PROCESS] Assignment updated successfully`);
            const updatedAssignment = await assignmentRepository.findOne({
                where: { id: assignment.id }
            });
            if (updatedAssignment) {
                const infusion_remaining_volume = (updatedAssignment.infusion_total_volume || 0) - (updatedAssignment.infusion_current_volume || 0);
                const topic = `bed/${updatedAssignment.bed_id}/assignment/update`;
                const payload = {
                    bed_id: updatedAssignment.bed_id,
                    assignment_id: updatedAssignment.id,
                    patient_id: updatedAssignment.patient_id,
                    infusion_percentage: Math.round(infusion_percentage * 100) / 100,
                    infusion_current_volume: updatedAssignment.infusion_current_volume,
                    infusion_remaining_volume: infusion_remaining_volume,
                    alert_type: alertType,
                    updated_at: new Date().toISOString()
                };
                this.mqttService.publishMessage(topic, payload);
                this.logger.log(`[IR POST-PROCESS] Published MQTT to ${topic}, alert_type: ${alertType}`);
                const previousAlertType = assignment.alert_type || null;
                if (alertType && alertType !== previousAlertType) {
                    this.logger.log(`[IR POST-PROCESS] Alert type changed: ${previousAlertType} → ${alertType}, creating notifications`);
                    await this.createNotificationsByAlertType(alertType, assignment, device, bed, room, hospitalId);
                }
                else if (alertType && alertType === previousAlertType) {
                    this.logger.log(`[IR POST-PROCESS] Alert type unchanged (${alertType}), skipping duplicate notification`);
                }
            }
        }
        catch (error) {
            this.logger.error(`[IR POST-PROCESS ERROR] ${error.message}`);
            this.logger.error(error.stack);
        }
    }
    async processLoadCellDeviceData(rawLog, assignment, device) {
        try {
            this.logger.log(`[LOAD_CELL POST-PROCESS] Starting LOAD_CELL device post-processing...`);
            const assignmentRepository = this.getRepository('patient_bed_assignments');
            if (assignment.last_measured_weight === null || assignment.last_measured_time === null) {
                this.logger.log(`[LOAD_CELL POST-PROCESS] First measurement - saving initial values`);
                await assignmentRepository.update(assignment.id, {
                    last_measured_weight: rawLog.weight,
                    last_measured_time: rawLog.time,
                });
                this.logger.log(`[LOAD_CELL POST-PROCESS] Initial weight: ${rawLog.weight}g, time: ${rawLog.time}`);
                return;
            }
            const weightDiff = assignment.last_measured_weight - rawLog.weight;
            if (weightDiff < 0) {
                this.logger.log(`[LOAD_CELL POST-PROCESS] IV bag replaced - weight increased`);
                await assignmentRepository.update(assignment.id, {
                    last_measured_weight: rawLog.weight,
                    last_measured_time: rawLog.time,
                });
                return;
            }
            const timeDiff = rawLog.time - assignment.last_measured_time;
            const flowRate = timeDiff > 0 ? (weightDiff * 3600000000) / timeDiff : 0;
            const newCurrentVolume = (assignment.infusion_current_volume || 0) + weightDiff;
            const rawLogWithCchr = { ...rawLog, cchr: flowRate };
            await this.checkSpeedAlerts(rawLogWithCchr, assignment, device);
            await assignmentRepository.update(assignment.id, {
                infusion_current_volume: newCurrentVolume,
                last_measured_weight: rawLog.weight,
                last_measured_time: rawLog.time,
            });
            const updatedAssignment = await assignmentRepository.findOne({
                where: { id: assignment.id }
            });
            if (updatedAssignment) {
                const infusion_remaining_volume = (updatedAssignment.infusion_total_volume || 0) - (updatedAssignment.infusion_current_volume || 0);
                const infusion_percentage = updatedAssignment.infusion_total_volume > 0
                    ? ((updatedAssignment.infusion_current_volume || 0) / updatedAssignment.infusion_total_volume) * 100
                    : 0;
                const topic = `bed/${updatedAssignment.bed_id}/assignment/update`;
                const payload = {
                    bed_id: updatedAssignment.bed_id,
                    assignment_id: updatedAssignment.id,
                    patient_id: updatedAssignment.patient_id,
                    infusion_percentage: Math.round(infusion_percentage * 100) / 100,
                    infusion_current_volume: updatedAssignment.infusion_current_volume,
                    infusion_remaining_volume: infusion_remaining_volume,
                    alert_type: null,
                    updated_at: new Date().toISOString()
                };
                this.mqttService.publishMessage(topic, payload);
                this.logger.log(`[LOAD_CELL POST-PROCESS] Published MQTT message to topic: ${topic}`);
                await this.checkAndSendNotifications(updatedAssignment, device, infusion_percentage);
            }
        }
        catch (error) {
            this.logger.error(`[LOAD_CELL POST-PROCESS ERROR] ${error.message}`);
            this.logger.error(error.stack);
        }
    }
    async createNotificationsByAlertType(alertType, assignment, device, bed, room, hospitalId) {
        try {
            this.logger.log(`[CREATE NOTIFICATIONS] Starting for alert_type: ${alertType}`);
            const wardId = room.ward_id;
            const wardSettingRepo = this.getRepository('ward_settings');
            const wardSettings = await wardSettingRepo.findOne({
                where: { ward_id: wardId }
            });
            if (!wardSettings) {
                this.logger.warn(`[CREATE NOTIFICATIONS] No ward_settings found for ward ${wardId}`);
                return;
            }
            let isEnabled = false;
            switch (alertType) {
                case 'stop':
                    isEnabled = wardSettings.stop_enabled == 1;
                    break;
                case 'fast':
                    isEnabled = wardSettings.fast_enabled == 1;
                    break;
                case 'slow':
                    isEnabled = wardSettings.slow_enabled == 1;
                    break;
                case 'almost_done':
                case 'done':
                    isEnabled = wardSettings.complete_enabled == 1;
                    break;
            }
            if (!isEnabled) {
                this.logger.log(`[CREATE NOTIFICATIONS] ${alertType} notification disabled in ward_settings for ward ${wardId}`);
                return;
            }
            const userRepository = this.getRepository('users');
            const users = await userRepository.find({
                where: { hospital_id: hospitalId, ward_id: wardId }
            });
            const targetUsers = users.filter(user => user.role === 'admin' || user.role === 'nurse');
            if (targetUsers.length === 0) {
                this.logger.log(`[CREATE NOTIFICATIONS] No admin/nurse users found for hospital ${hospitalId}`);
                return;
            }
            let title = '';
            let message = '';
            switch (alertType) {
                case 'stop':
                    title = '수액 주입 정지';
                    message = `${room.name}호-${bed.bed_number}번 병상의 수액 주입이 정지되었습니다.`;
                    break;
                case 'fast':
                    title = '수액 주입 속도 빠름';
                    message = `${room.name}호-${bed.bed_number}번 병상의 수액 주입 속도가 빠릅니다.`;
                    break;
                case 'slow':
                    title = '수액 주입 속도 느림';
                    message = `${room.name}호-${bed.bed_number}번 병상의 수액 주입 속도가 느립니다.`;
                    break;
                case 'almost_done':
                    title = '수액 투여 완료 임박';
                    message = `${room.name}호-${bed.bed_number}번 병상의 수액 투여가 완료 임박입니다.`;
                    break;
                case 'done':
                    title = '수액 투여 완료';
                    message = `${room.name}호-${bed.bed_number}번 병상의 수액 투여가 완료되었습니다.`;
                    break;
            }
            for (const user of targetUsers) {
                await this.insertData('notifications', {
                    user_id: user.id,
                    patient_bed_assignment_id: assignment.id,
                    device_id: device.id,
                    title: title,
                    message: message,
                    type: alertType,
                    is_read: 0,
                });
                this.logger.log(`[CREATE NOTIFICATIONS] Created ${alertType} notification for user ${user.id}`);
                if (user.fcm_token) {
                    const alertCategory = this.deriveAlertCategory(alertType);
                    await this.fcmService.sendPush(user.fcm_token, title, message, {
                        alert_category: alertCategory || '',
                        alert_type: alertType,
                    });
                }
            }
        }
        catch (error) {
            this.logger.error(`[CREATE NOTIFICATIONS ERROR] ${error.message}`);
            this.logger.error(error.stack);
        }
    }
    async checkSpeedAlerts(rawLog, assignment, device) {
        try {
            this.logger.log(`[SPEED ALERT CHECK] Starting for assignment ID: ${assignment.id}, cchr: ${rawLog.cchr}`);
            if (assignment.released_at) {
                this.logger.log(`[SPEED ALERT CHECK] Assignment already released, skipping`);
                return;
            }
            if (rawLog.cchr === undefined || rawLog.cchr === null) {
                this.logger.log(`[SPEED ALERT CHECK] No cchr data, skipping`);
                return;
            }
            const assignedAt = new Date(assignment.assigned_at);
            const now = new Date();
            const timeDiffMinutes = (now.getTime() - assignedAt.getTime()) / (1000 * 60);
            if (timeDiffMinutes < 2) {
                this.logger.log(`[SPEED ALERT CHECK] Skipping - less than 2 minutes since assigned_at (${timeDiffMinutes.toFixed(1)}/2.0 minutes)`);
                return;
            }
            if (!assignment.infusion_cchr || assignment.infusion_cchr === 0) {
                this.logger.log(`[SPEED ALERT CHECK] Skipping - infusion_cchr is 0 or null`);
                return;
            }
            const bedRepository = this.getRepository('beds');
            const bed = await bedRepository.findOne({
                where: { id: assignment.bed_id },
                relations: ['room', 'room.ward', 'room.ward.hospital']
            });
            if (!bed || !bed.room || !bed.room.ward) {
                this.logger.warn(`[SPEED ALERT CHECK] Bed hierarchy not found for bed_id: ${assignment.bed_id}`);
                return;
            }
            const ward = bed.room.ward;
            const room = bed.room;
            this.logger.log(`[SPEED ALERT CHECK] Hospital ID: ${ward.hospital_id}, Ward ID: ${ward.id}, Room: ${room.name}, Bed: ${bed.bed_number}`);
            const wardSettingRepository = this.getRepository('ward_settings');
            const wardSettings = await wardSettingRepository.findOne({
                where: { ward_id: ward.id }
            });
            if (!wardSettings) {
                this.logger.warn(`[SPEED ALERT CHECK] No ward_settings found for ward ${ward.id}`);
                return;
            }
            let alertType = null;
            let alertTitle = '';
            let alertMessage = '';
            if (wardSettings.stop_enabled == 1 && rawLog.cchr === 0) {
                alertType = 'stop';
                alertTitle = '수액 주입 정지';
                alertMessage = `${room.name}호-${bed.bed_number}번 병상의 수액 주입이 정지되었습니다.`;
            }
            if (!alertType && wardSettings.fast_enabled == 1) {
                const fastThreshold = assignment.infusion_cchr * (1 + wardSettings.fast_threshold / 100);
                this.logger.log(`[SPEED ALERT CHECK] Fast threshold: ${fastThreshold.toFixed(2)} (infusion_cchr: ${assignment.infusion_cchr}, fast_threshold: ${wardSettings.fast_threshold}%)`);
                if (rawLog.cchr > fastThreshold && rawLog.cchr >= 0 && rawLog.cchr <= 9999) {
                    alertType = 'fast';
                    alertTitle = '수액 주입 속도 빠름';
                    alertMessage = `${room.name}호-${bed.bed_number}번 병상의 수액 주입 속도가 빠릅니다. (${Math.round(rawLog.cchr)} cc/hr)`;
                }
                else if (rawLog.cchr > 9999) {
                    this.logger.warn(`[SPEED ALERT CHECK] FAST condition met but cchr value out of range (${rawLog.cchr}), notification not created`);
                }
            }
            if (!alertType && wardSettings.slow_enabled == 1) {
                const slowThreshold = assignment.infusion_cchr * (1 - Math.abs(wardSettings.slow_threshold) / 100);
                this.logger.log(`[SPEED ALERT CHECK] Slow threshold: ${slowThreshold.toFixed(2)} (infusion_cchr: ${assignment.infusion_cchr}, slow_threshold: -${Math.abs(wardSettings.slow_threshold)}%)`);
                if (rawLog.cchr < slowThreshold && rawLog.cchr > 0 && rawLog.cchr <= 9999) {
                    alertType = 'slow';
                    alertTitle = '수액 주입 속도 느림';
                    alertMessage = `${room.name}호-${bed.bed_number}번 병상의 수액 주입 속도가 느립니다. (${Math.round(rawLog.cchr)} cc/hr)`;
                }
                else if (rawLog.cchr > 9999) {
                    this.logger.warn(`[SPEED ALERT CHECK] SLOW condition met but cchr value out of range (${rawLog.cchr}), notification not created`);
                }
            }
            if (!alertType) {
                this.logger.log(`[SPEED ALERT CHECK] No alert condition met`);
                return;
            }
            const previousAlertType = assignment.alert_type || null;
            if (alertType === previousAlertType) {
                this.logger.log(`[SPEED ALERT CHECK] Alert type unchanged (${alertType}), skipping`);
                return;
            }
            this.logger.log(`[SPEED ALERT CHECK] Alert type changed: ${previousAlertType} → ${alertType}`);
            const userRepository = this.getRepository('users');
            const users = await userRepository.find({
                where: {
                    hospital_id: ward.hospital_id,
                    ward_id: ward.id,
                }
            });
            const targetUsers = users.filter(user => user.role === 'admin' || user.role === 'nurse');
            if (targetUsers.length === 0) {
                this.logger.log(`[SPEED ALERT CHECK] No users found for ward ${ward.id}`);
                return;
            }
            this.logger.log(`[SPEED ALERT CHECK] Found ${targetUsers.length} users for alert`);
            for (const user of targetUsers) {
                await this.insertData('notifications', {
                    user_id: user.id,
                    patient_bed_assignment_id: assignment.id,
                    device_id: device.id,
                    title: alertTitle,
                    message: alertMessage,
                    type: alertType,
                    is_read: 0,
                });
                this.logger.log(`[SPEED ALERT CHECK] ${alertType.toUpperCase()} notification created for user ${user.id}`);
                if (user.fcm_token) {
                    const alertCategory = this.deriveAlertCategory(alertType);
                    await this.fcmService.sendPush(user.fcm_token, alertTitle, alertMessage, {
                        alert_category: alertCategory || '',
                        alert_type: alertType,
                    });
                }
            }
        }
        catch (error) {
            this.logger.error(`[SPEED ALERT CHECK ERROR] ${error.message}`);
            this.logger.error(error.stack);
        }
    }
    async checkAndSendNotifications(assignment, device, infusionPercentage) {
        try {
            this.logger.log(`[NOTIFICATION CHECK] Starting notification check for assignment ID: ${assignment.id}`);
            if (assignment.released_at) {
                this.logger.log(`[NOTIFICATION CHECK] Assignment already released, skipping notification`);
                return;
            }
            const bedRepository = this.getRepository('beds');
            const bed = await bedRepository.findOne({
                where: { id: assignment.bed_id },
                relations: ['room', 'room.ward', 'room.ward.hospital']
            });
            if (!bed || !bed.room || !bed.room.ward) {
                this.logger.warn(`[NOTIFICATION CHECK] Bed hierarchy not found for bed_id: ${assignment.bed_id}`);
                return;
            }
            const ward = bed.room.ward;
            const room = bed.room;
            this.logger.log(`[NOTIFICATION CHECK] Hospital ID: ${ward.hospital_id}, Ward ID: ${ward.id}, Room: ${room.name}, Bed: ${bed.bed_number}`);
            const wardSettingRepository = this.getRepository('ward_settings');
            const wardSettings = await wardSettingRepository.findOne({
                where: { ward_id: ward.id }
            });
            if (!wardSettings) {
                this.logger.warn(`[NOTIFICATION CHECK] No ward_settings found for ward ${ward.id}`);
                return;
            }
            if (wardSettings.complete_enabled !== 1 || infusionPercentage < wardSettings.complete_threshold) {
                this.logger.log(`[NOTIFICATION CHECK] Complete alert not triggered: enabled=${wardSettings.complete_enabled}, ${infusionPercentage.toFixed(1)}% < ${wardSettings.complete_threshold}%`);
                return;
            }
            this.logger.log(`[NOTIFICATION CHECK] Complete threshold met: ${infusionPercentage.toFixed(1)}% >= ${wardSettings.complete_threshold}%`);
            const userRepository = this.getRepository('users');
            const users = await userRepository.find({
                where: {
                    hospital_id: ward.hospital_id,
                    ward_id: ward.id,
                }
            });
            const targetUsers = users.filter(user => user.role === 'admin' || user.role === 'nurse');
            if (targetUsers.length === 0) {
                this.logger.log(`[NOTIFICATION CHECK] No users found for ward ${ward.id}`);
                return;
            }
            this.logger.log(`[NOTIFICATION CHECK] Found ${targetUsers.length} users for notification`);
            const notificationRepository = this.getRepository('notifications');
            for (const user of targetUsers) {
                const unreadNotification = await notificationRepository.findOne({
                    where: {
                        patient_bed_assignment_id: assignment.id,
                        user_id: user.id,
                        type: 'almost_done',
                        is_read: 0,
                    }
                });
                if (unreadNotification) {
                    this.logger.log(`[NOTIFICATION CHECK] User ${user.id} - ALMOST_DONE notification already exists, skipping duplicate`);
                    continue;
                }
                const almostDoneTitle = '수액 투여 완료 임박';
                const almostDoneMessage = `${room.name}호-${bed.bed_number}번 병상의 수액이 ${Math.round(infusionPercentage)}% 진행 되었습니다.`;
                await this.insertData('notifications', {
                    user_id: user.id,
                    patient_bed_assignment_id: assignment.id,
                    device_id: device.id,
                    title: almostDoneTitle,
                    message: almostDoneMessage,
                    type: 'almost_done',
                    is_read: 0,
                });
                this.logger.log(`[NOTIFICATION CHECK] Notification created for user ${user.id}`);
                if (user.fcm_token) {
                    await this.fcmService.sendPush(user.fcm_token, almostDoneTitle, almostDoneMessage, {
                        alert_category: 'caution',
                        alert_type: 'almost_done',
                    });
                }
            }
        }
        catch (error) {
            this.logger.error(`[NOTIFICATION CHECK ERROR] ${error.message}`);
            this.logger.error(error.stack);
        }
    }
    async testNotification(assignmentId, targetPercentage) {
        try {
            this.logger.log(`[TEST] Starting notification test for assignment ${assignmentId}, target: ${targetPercentage}%`);
            const assignmentRepository = this.getRepository('patient_bed_assignments');
            const assignment = await assignmentRepository.findOne({
                where: { id: assignmentId },
                relations: ['device', 'bed', 'bed.room', 'bed.room.ward']
            });
            if (!assignment) {
                throw new common_1.HttpException(`Assignment with id ${assignmentId} not found`, common_1.HttpStatus.NOT_FOUND);
            }
            this.logger.log(`[TEST] Assignment found: ID ${assignment.id}`);
            this.logger.log(`[TEST] Total volume: ${assignment.infusion_total_volume} ml`);
            this.logger.log(`[TEST] Current volume (before): ${assignment.infusion_current_volume} ml`);
            const targetCurrentVolume = (assignment.infusion_total_volume * targetPercentage) / 100;
            this.logger.log(`[TEST] Target current volume: ${targetCurrentVolume} ml (${targetPercentage}%)`);
            await assignmentRepository.update(assignmentId, {
                infusion_current_volume: targetCurrentVolume,
                assigned_at: new Date()
            });
            this.logger.log(`[TEST] Updated assignment current volume to ${targetCurrentVolume} ml`);
            const deviceRepository = this.getRepository('devices');
            const device = await deviceRepository.findOne({
                where: { id: assignment.device_id }
            });
            if (!device) {
                throw new common_1.HttpException(`Device with id ${assignment.device_id} not found`, common_1.HttpStatus.NOT_FOUND);
            }
            const updatedAssignment = await assignmentRepository.findOne({
                where: { id: assignmentId }
            });
            await this.checkAndSendNotifications(updatedAssignment, device, targetPercentage);
            this.logger.log(`[TEST] Notification check completed`);
            return {
                success: true,
                message: 'Notification test completed',
                data: {
                    assignment_id: assignmentId,
                    target_percentage: targetPercentage,
                    target_current_volume: targetCurrentVolume,
                    total_volume: assignment.infusion_total_volume,
                    device_id: device.id,
                    bed_id: assignment.bed_id
                }
            };
        }
        catch (error) {
            this.logger.error(`[TEST ERROR] ${error.message}`);
            this.logger.error(error.stack);
            throw error;
        }
    }
    async upsertPatientBedAssignment(data) {
        try {
            this.logger.log(`[UPSERT ASSIGNMENT] Starting upsert for bed_id: ${data.bed_id}, device_id: ${data.device_id}`);
            if (data.bed_id && data.device_id) {
                const bedRepository = this.getRepository('beds');
                const deviceRepository = this.getRepository('devices');
                const bed = await bedRepository.findOne({
                    where: { id: data.bed_id },
                    relations: ['room', 'room.ward']
                });
                if (!bed) {
                    throw new common_1.HttpException('침대 정보를 찾을 수 없습니다', common_1.HttpStatus.NOT_FOUND);
                }
                if (!bed.room?.ward) {
                    throw new common_1.HttpException('침대의 병동 정보를 찾을 수 없습니다', common_1.HttpStatus.BAD_REQUEST);
                }
                const bedHospitalId = bed.room.ward.hospital_id;
                const device = await deviceRepository.findOne({
                    where: { id: data.device_id }
                });
                if (!device) {
                    throw new common_1.HttpException('디바이스 정보를 찾을 수 없습니다', common_1.HttpStatus.NOT_FOUND);
                }
                if (device.hospital_id !== bedHospitalId) {
                    this.logger.warn(`[UPSERT ASSIGNMENT] Hospital ID mismatch - bed hospital_id: ${bedHospitalId}, device hospital_id: ${device.hospital_id}`);
                    throw new common_1.HttpException('해당 병원에서 관리하는 기기 정보가 아닙니다', common_1.HttpStatus.BAD_REQUEST);
                }
                this.logger.log(`[UPSERT ASSIGNMENT] Hospital ID validation passed - hospital_id: ${bedHospitalId}`);
            }
            const assignmentRepository = this.getRepository('patient_bed_assignments');
            const existingAssignment = await assignmentRepository.findOne({
                where: {
                    bed_id: data.bed_id,
                    device_id: (0, typeorm_1.IsNull)(),
                    assigned_at: (0, typeorm_1.IsNull)(),
                    released_at: (0, typeorm_1.IsNull)(),
                }
            });
            if (existingAssignment) {
                this.logger.log(`[UPSERT ASSIGNMENT] Found existing assignment ID: ${existingAssignment.id}, updating...`);
                await assignmentRepository.update(existingAssignment.id, {
                    device_id: data.device_id,
                    assigned_at: new Date(),
                });
                if (data.device_id) {
                    const deviceRepository = this.getRepository('devices');
                    const bedRepository = this.getRepository('beds');
                    const bed = await bedRepository.findOne({
                        where: { id: data.bed_id },
                        relations: ['room', 'room.ward']
                    });
                    if (bed?.room?.ward) {
                        await deviceRepository.update(data.device_id, {
                            bed_id: data.bed_id,
                            room_id: bed.room.id,
                            ward_id: bed.room.ward.id,
                            hospital_id: bed.room.ward.hospital_id,
                            last_udpate_at: new Date(),
                        });
                        this.logger.log(`[UPSERT ASSIGNMENT] Updated device ${data.device_id} - bed_id: ${data.bed_id}, room_id: ${bed.room.id}, ward_id: ${bed.room.ward.id}, hospital_id: ${bed.room.ward.hospital_id}`);
                    }
                    else {
                        await deviceRepository.update(data.device_id, {
                            bed_id: data.bed_id,
                            last_udpate_at: new Date(),
                        });
                        this.logger.log(`[UPSERT ASSIGNMENT] Updated device ${data.device_id} - bed_id: ${data.bed_id} (no bed hierarchy found)`);
                    }
                }
                if (data.bed_id) {
                    const bedRepository = this.getRepository('beds');
                    await bedRepository.update(data.bed_id, { status: 'occupied' });
                    this.logger.log(`[UPSERT ASSIGNMENT] Updated bed ${data.bed_id} status to occupied`);
                }
                const updatedAssignment = await assignmentRepository.findOne({
                    where: { id: existingAssignment.id },
                    relations: ['bed', 'bed.room', 'bed.room.ward']
                });
                this.logger.log(`[UPSERT ASSIGNMENT] Successfully updated assignment ID: ${existingAssignment.id}`);
                if (data.infusion_type) {
                    try {
                        const infusionRepository = this.getRepository('infusions');
                        const infusion = await infusionRepository.findOne({ where: { name: data.infusion_type, is_active: true } });
                        if (infusion) {
                            await infusionRepository.increment({ id: infusion.id }, 'usage_count', 1);
                            this.logger.log(`[UPSERT ASSIGNMENT] usage_count incremented for infusion "${data.infusion_type}" (id=${infusion.id})`);
                        }
                    }
                    catch (usageError) {
                        this.logger.error(`[UPSERT ASSIGNMENT] usage_count update failed: ${usageError.message}`);
                    }
                }
                if (updatedAssignment?.bed?.room?.ward) {
                    const hospitalId = updatedAssignment.bed.room.ward.hospital_id;
                    await this.sendAssignmentRefreshNotification(hospitalId, {
                        assignment_id: updatedAssignment.id,
                        bed_id: updatedAssignment.bed_id,
                        patient_id: updatedAssignment.patient_id,
                        action: 'update'
                    });
                }
                return updatedAssignment;
            }
            else {
                this.logger.log(`[UPSERT ASSIGNMENT] No existing assignment found, creating new...`);
                const createData = {
                    ...data,
                    assigned_at: new Date()
                };
                const result = await this.insertData('patient_bed_assignments', createData);
                if (data.device_id && data.infusion_total_volume && data.infusion_cchr) {
                    const deviceRepository = this.getRepository('devices');
                    deviceRepository.findOne({ where: { id: data.device_id } }).then(targetDevice => {
                        if (targetDevice && targetDevice.serial_number) {
                            this.mqttService.sendDeviceSetting(targetDevice.serial_number, {
                                totalVolume: data.infusion_total_volume,
                                flowRate: data.infusion_cchr,
                                infusion_current_volume: 0,
                            });
                            this.logger.log(`[TEST]1 기기(${targetDevice.serial_number})에 신규 수액 배정 -> 누적총량 0 리셋 명령 전송됨!`);
                            this.logger.log(`[UPSERT ASSIGNMENT] 기기(${targetDevice.serial_number})로 용량 및 속도 전송 완료!`);
                        }
                    }).catch(err => {
                        this.logger.error(`[UPSERT ASSIGNMENT] 기기 정보 조회 실패: ${err.message}`);
                    });
                }
                if (data.infusion_type) {
                    try {
                        const infusionRepository = this.getRepository('infusions');
                        const infusion = await infusionRepository.findOne({ where: { name: data.infusion_type, is_active: true } });
                        if (infusion) {
                            await infusionRepository.increment({ id: infusion.id }, 'usage_count', 1);
                            this.logger.log(`[UPSERT ASSIGNMENT] usage_count incremented for infusion "${data.infusion_type}" (id=${infusion.id})`);
                        }
                    }
                    catch (usageError) {
                        this.logger.error(`[UPSERT ASSIGNMENT] usage_count update failed: ${usageError.message}`);
                    }
                }
                const bedRepository = this.getRepository('beds');
                const bed = await bedRepository.findOne({
                    where: { id: data.bed_id },
                    relations: ['room', 'room.ward']
                });
                if (bed?.room?.ward) {
                    const hospitalId = bed.room.ward.hospital_id;
                    await this.sendAssignmentRefreshNotification(hospitalId, {
                        assignment_id: result.id,
                        bed_id: result.bed_id,
                        patient_id: result.patient_id,
                        action: 'create'
                    });
                }
                return result;
            }
        }
        catch (error) {
            this.logger.error(`[UPSERT ASSIGNMENT ERROR] ${error.message}`);
            this.logger.error(error.stack);
            throw error;
        }
    }
    async sendAssignmentRefreshNotification(hospitalId, payload) {
        try {
            const userRepository = this.getRepository('users');
            const users = await userRepository.find({
                where: { hospital_id: hospitalId }
            });
            const targetUsers = users.filter(user => user.role === 'super_admin' || user.role === 'admin' || user.role === 'nurse');
            for (const user of targetUsers) {
                const topic = `user/${user.id}/assignment/refresh`;
                this.mqttService.publishMessage(topic, payload);
            }
            this.logger.log(`[ASSIGNMENT REFRESH] Sent notification to ${targetUsers.length} users in hospital ${hospitalId}`);
        }
        catch (error) {
            this.logger.error(`[ASSIGNMENT REFRESH ERROR] ${error.message}`);
        }
    }
    async generateMockAssignment(hospitalId, wardId) {
        try {
            this.logger.log(`[MOCK] Generating mock assignment for hospital ${hospitalId}, ward ${wardId || 'all'}`);
            const roomRepository = this.getRepository('rooms');
            let rooms;
            if (wardId) {
                rooms = await roomRepository.find({
                    where: { ward_id: wardId }
                });
            }
            else {
                const wardRepository = this.getRepository('wards');
                const wards = await wardRepository.find({
                    where: { hospital_id: hospitalId }
                });
                if (wards.length === 0) {
                    return {
                        success: false,
                        statusCode: 404,
                        message: `No wards found for hospital ${hospitalId}`
                    };
                }
                const wardIds = wards.map(w => w.id);
                rooms = await roomRepository
                    .createQueryBuilder('room')
                    .where('room.ward_id IN (:...wardIds)', { wardIds })
                    .getMany();
            }
            if (rooms.length === 0) {
                return {
                    success: false,
                    statusCode: 404,
                    message: wardId ? `No rooms found for ward ${wardId}` : `No rooms found for hospital ${hospitalId}`
                };
            }
            const bedRepository = this.getRepository('beds');
            const roomIds = rooms.map(r => r.id);
            const availableBeds = await bedRepository
                .createQueryBuilder('bed')
                .where('bed.room_id IN (:...roomIds)', { roomIds })
                .andWhere('bed.status = :status', { status: 'available' })
                .getMany();
            if (availableBeds.length === 0) {
                throw new common_1.HttpException('사용 가능한 병상이 없습니다', common_1.HttpStatus.CONFLICT);
            }
            const randomBed = availableBeds[Math.floor(Math.random() * availableBeds.length)];
            this.logger.log(`[MOCK] Selected bed: ${randomBed.bed_number} (ID: ${randomBed.id})`);
            const randomRoom = rooms.find(r => r.id === randomBed.room_id);
            this.logger.log(`[MOCK] Selected room: ${randomRoom.name} (ID: ${randomRoom.id})`);
            const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
            const firstNames = ['민수', '지혜', '서준', '하은', '도윤', '서연', '예준', '수빈', '시우', '지민'];
            const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const patientName = `${randomLastName}${randomFirstName}`;
            const chartNumber = `P${Date.now()}`;
            const sexOptions = ['M', 'F'];
            const randomSex = sexOptions[Math.floor(Math.random() * sexOptions.length)];
            const randomAge = Math.floor(Math.random() * 66) + 20;
            const now = new Date();
            const birthYear = now.getFullYear() - randomAge;
            const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
            const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
            const dob = `${birthYear}-${birthMonth}-${birthDay}`;
            const deptCodes = ['NUR01', 'GS01', 'IM01', 'OS01', 'NS01', 'CS01', 'UR01', 'OB01', 'PD01', 'EM01'];
            const randomDept = deptCodes[Math.floor(Math.random() * deptCodes.length)];
            const docNames = ['이승훈', '박지영', '김태호', '정민서', '최동혁', '강수진', '윤재석', '한미라'];
            const residentNames = ['송현우', '오지은', '배성민', '류하늘', '신예린', '고준형'];
            const nurseNames = ['김수연', '이지원', '박하늘', '최유진', '정다은', '강서윤'];
            const randomDoc = docNames[Math.floor(Math.random() * docNames.length)];
            const randomResident = residentNames[Math.floor(Math.random() * residentNames.length)];
            const randomPaNurse = nurseNames[Math.floor(Math.random() * nurseNames.length)];
            const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const seq = String(Math.floor(Math.random() * 900) + 100);
            const adm = `ADM${today}${seq}`;
            const patientRepository = this.getRepository('patients');
            const patient = await patientRepository.save({
                name: patientName,
                chart_number: chartNumber,
                sex: randomSex,
                age: randomAge,
                dob,
                dept: randomDept,
                doc: randomDoc,
                resident: randomResident,
                pa_nurse: randomPaNurse,
                adm,
            });
            this.logger.log(`[MOCK] Created patient: ${patient.name} (ID: ${patient.id})`);
            const vitalRepository = this.getRepository('patient_vitals');
            const randomHeight = (Math.random() * 40 + 150).toFixed(1);
            const randomWeight = (Math.random() * 50 + 45).toFixed(1);
            const vitalTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            await vitalRepository.save({
                patient_id: patient.id,
                adm,
                date: today,
                time: vitalTime,
                nurse_key: null,
                height: parseFloat(randomHeight),
                weight: parseFloat(randomWeight),
            });
            this.logger.log(`[MOCK] Created patient_vital: height=${randomHeight}, weight=${randomWeight}`);
            const infusionRepository = this.getRepository('infusions');
            const infusionMasters = await infusionRepository.find({ where: { is_active: true } });
            const infusionOptions = infusionMasters.length > 0
                ? infusionMasters.map(inf => ({
                    id: inf.id,
                    type: `${inf.name} ${inf.default_volume || 500}ml`,
                    code: inf.code,
                    volume: inf.default_volume || 500,
                    defaultCchr: inf.default_cchr || 164.10,
                }))
                : [
                    { id: null, type: '생리식염수 500ml', code: 'NS', volume: 500, defaultCchr: 164.10 },
                    { id: null, type: '5% 포도당 500ml', code: 'DW', volume: 500, defaultCchr: 164.10 },
                    { id: null, type: '하트만용액 500ml', code: 'HD', volume: 500, defaultCchr: 262.56 },
                ];
            const cchrOptions = [131.28, 164.10, 196.92, 229.74, 262.56, 328.20, 393.84];
            const infusionCount = Math.random() < 0.6 ? 1 : 2;
            const assignmentRepository = this.getRepository('patient_bed_assignments');
            const assignments = [];
            for (let i = 0; i < infusionCount; i++) {
                const infusion = infusionOptions[Math.floor(Math.random() * infusionOptions.length)];
                const cchr = cchrOptions[Math.floor(Math.random() * cchrOptions.length)];
                const currentVolume = Math.floor(Math.random() * infusion.volume * 0.7);
                const assignment = await assignmentRepository.save({
                    patient_id: patient.id,
                    bed_id: randomBed.id,
                    device_id: null,
                    drug_order_id: null,
                    infusion_id: infusion.id || null,
                    infusion_type: infusion.type,
                    infusion_code: infusion.code,
                    infusion_total_volume: infusion.volume,
                    infusion_current_volume: currentVolume,
                    infusion_cchr: cchr,
                    status: 'infusing',
                    is_active: true,
                    assigned_at: now,
                    started_at: now,
                    released_at: null,
                });
                assignments.push(assignment);
                this.logger.log(`[MOCK] Created assignment: ID ${assignment.id}, ${infusion.type}`);
            }
            await bedRepository.update(randomBed.id, { status: 'occupied' });
            this.logger.log(`[MOCK] Updated bed ${randomBed.id} status to occupied`);
            return {
                success: true,
                message: 'Mock assignment created successfully',
                data: {
                    patient: {
                        id: patient.id,
                        name: patient.name,
                        chart_number: patient.chart_number,
                        sex: randomSex,
                        age: randomAge,
                    },
                    bed: {
                        id: randomBed.id,
                        bed_number: randomBed.bed_number
                    },
                    room: {
                        id: randomRoom.id,
                        name: randomRoom.name
                    },
                    assignments: assignments.map(a => ({
                        assignment_id: a.id,
                        infusion_id: a.infusion_id,
                        infusion_type: a.infusion_type,
                        infusion_code: a.infusion_code,
                        total_volume: a.infusion_total_volume,
                        current_volume: a.infusion_current_volume,
                        cchr: a.infusion_cchr,
                        status: a.status,
                    }))
                }
            };
        }
        catch (error) {
            this.logger.error(`[MOCK ERROR] ${error.message}`);
            this.logger.error(error.stack);
            throw error;
        }
    }
    async addInfusion(data) {
        let infusionCchr;
        if (data.infusion_cchr !== undefined) {
            infusionCchr = data.infusion_cchr;
        }
        else if (data.infusion_gtt !== undefined) {
            infusionCchr = Math.round(data.infusion_gtt * 3.282 * 100) / 100;
        }
        const assignmentRepository = this.getRepository('patient_bed_assignments');
        const emptyAssignment = await assignmentRepository.findOne({
            where: {
                patient_id: data.patient_id,
                bed_id: data.bed_id,
                released_at: (0, typeorm_1.IsNull)(),
                infusion_type: (0, typeorm_1.IsNull)(),
            },
        });
        const activeCount = await assignmentRepository.count({
            where: {
                patient_id: data.patient_id,
                bed_id: data.bed_id,
                released_at: (0, typeorm_1.IsNull)(),
                infusion_type: (0, typeorm_1.Not)((0, typeorm_1.IsNull)()),
            }
        });
        if (activeCount >= 3) {
            throw new common_1.HttpException('환자당 최대 3개 수액까지만 동시 투여 가능합니다.', common_1.HttpStatus.BAD_REQUEST);
        }
        let assignment;
        if (emptyAssignment) {
            await assignmentRepository.update(emptyAssignment.id, {
                drug_order_id: data.drug_order_id || null,
                infusion_id: data.infusion_id || null,
                infusion_type: data.infusion_type,
                infusion_code: data.infusion_code || null,
                infusion_total_volume: data.infusion_total_volume,
                infusion_current_volume: 0,
                infusion_cchr: infusionCchr || 164.10,
                status: 'pending',
                is_active: true,
            });
            assignment = await assignmentRepository.findOne({ where: { id: emptyAssignment.id } });
            this.logger.log(`[ADD_INFUSION] Reused empty assignment ${emptyAssignment.id} for patient_id=${data.patient_id}, infusion=${data.infusion_type}, infusion_id=${data.infusion_id}`);
        }
        else {
            const now = new Date();
            assignment = await assignmentRepository.save({
                patient_id: data.patient_id,
                bed_id: data.bed_id,
                device_id: null,
                drug_order_id: data.drug_order_id || null,
                infusion_id: data.infusion_id || null,
                infusion_type: data.infusion_type,
                infusion_code: data.infusion_code || null,
                infusion_total_volume: data.infusion_total_volume,
                infusion_current_volume: 0,
                infusion_cchr: infusionCchr || 164.10,
                status: 'pending',
                is_active: true,
                assigned_at: now,
                released_at: null,
            });
            this.logger.log(`[ADD_INFUSION] Created new assignment ${assignment.id} for patient_id=${data.patient_id}, infusion=${data.infusion_type}, infusion_id=${data.infusion_id}`);
        }
        if (data.bed_id) {
            try {
                const bedRepository = this.getRepository('beds');
                const bed = await bedRepository.findOne({
                    where: { id: data.bed_id },
                    relations: ['room', 'room.ward']
                });
                if (bed?.room?.ward?.hospital_id) {
                    await this.sendAssignmentRefreshNotification(bed.room.ward.hospital_id, {
                        assignment_id: assignment.id,
                        bed_id: data.bed_id,
                        patient_id: data.patient_id,
                        action: 'add_infusion'
                    });
                }
            }
            catch (mqttError) {
                this.logger.error(`[ADD_INFUSION] MQTT notification failed: ${mqttError.message}`);
            }
        }
        try {
            const infusionRepository = this.getRepository('infusions');
            if (data.infusion_id) {
                await infusionRepository.increment({ id: data.infusion_id }, 'usage_count', 1);
                this.logger.log(`[ADD_INFUSION] usage_count incremented for infusion_id=${data.infusion_id}`);
            }
            else if (data.infusion_type) {
                const infusion = await infusionRepository.findOne({ where: { name: data.infusion_type, is_active: true } });
                if (infusion) {
                    await infusionRepository.increment({ id: infusion.id }, 'usage_count', 1);
                    this.logger.log(`[ADD_INFUSION] usage_count incremented for infusion name="${data.infusion_type}" (id=${infusion.id})`);
                }
            }
        }
        catch (usageError) {
            this.logger.error(`[ADD_INFUSION] usage_count update failed: ${usageError.message}`);
        }
        return {
            success: true,
            message: '수액이 추가되었습니다.',
            data: {
                assignment_id: assignment.id,
                patient_id: data.patient_id,
                bed_id: data.bed_id,
                infusion_id: assignment.infusion_id,
                infusion_type: assignment.infusion_type,
                infusion_code: assignment.infusion_code,
                total_volume: assignment.infusion_total_volume,
                cchr: assignment.infusion_cchr,
                status: assignment.status,
                active_infusion_count: activeCount + 1,
            }
        };
    }
};
exports.AppService = AppService;
exports.AppService = AppService = AppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => mqtt_service_1.MqttService))),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        mqtt_service_1.MqttService,
        fcm_service_1.FcmService])
], AppService);
//# sourceMappingURL=app.service.js.map