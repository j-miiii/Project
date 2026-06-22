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
var DeviceStatusScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceStatusScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const device_entity_1 = require("../entities/device.entity");
const infusion_raw_log_entity_1 = require("../entities/infusion-raw-log.entity");
const patient_bed_assignment_entity_1 = require("../entities/patient-bed-assignment.entity");
const mqtt_service_1 = require("../mqtt/mqtt.service");
let DeviceStatusScheduler = DeviceStatusScheduler_1 = class DeviceStatusScheduler {
    constructor(dataSource, mqttService, configService) {
        this.dataSource = dataSource;
        this.mqttService = mqttService;
        this.configService = configService;
        this.logger = new common_1.Logger(DeviceStatusScheduler_1.name);
        this.timeoutSeconds = this.configService.get('DEVICE_TIMEOUT_SECONDS', 120);
        this.logger.log(`[DEVICE TIMEOUT CONFIG] Timeout set to ${this.timeoutSeconds} seconds`);
    }
    async checkDeviceStatus() {
        await this.checkDeviceStatusWithRetry(3);
    }
    async checkInfusionDataTimeout() {
        await this.checkInfusionDataTimeoutWithRetry(3);
    }
    async checkDeviceStatusWithRetry(maxRetries, currentAttempt = 1) {
        try {
            this.logger.log('[DEVICE STATUS CHECK] Starting device status check...');
            const deviceRepository = this.dataSource.getRepository(device_entity_1.Device);
            const logRepository = this.dataSource.getRepository(infusion_raw_log_entity_1.InfusionRawLog);
            const onlineDevices = await deviceRepository.find({
                where: { network_status: 'online' }
            });
            if (onlineDevices.length === 0) {
                this.logger.log('[DEVICE STATUS CHECK] No online devices found');
                return;
            }
            this.logger.log(`[DEVICE STATUS CHECK] Found ${onlineDevices.length} online devices`);
            const timeoutDate = new Date();
            timeoutDate.setSeconds(timeoutDate.getSeconds() - this.timeoutSeconds);
            let offlineCount = 0;
            for (const device of onlineDevices) {
                const recentLog = await logRepository
                    .createQueryBuilder('log')
                    .where('log.sn = :sn', { sn: device.serial_number })
                    .andWhere('log.created_at >= :timeoutDate', { timeoutDate })
                    .orderBy('log.created_at', 'DESC')
                    .limit(1)
                    .getOne();
                if (!recentLog) {
                    await deviceRepository.update(device.id, {
                        network_status: 'offline'
                    });
                    offlineCount++;
                    this.logger.log(`[DEVICE STATUS CHECK] Device ${device.id} (SN: ${device.serial_number}) set to OFFLINE - No data in last 2 minutes`);
                }
            }
            this.logger.log(`[DEVICE STATUS CHECK] Completed - ${offlineCount} devices set to offline`);
        }
        catch (error) {
            if (error.code === 'ECONNRESET' || error.errno === -54) {
                if (currentAttempt < maxRetries) {
                    this.logger.warn(`[DEVICE STATUS CHECK] DB connection error, retrying... (${currentAttempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.checkDeviceStatusWithRetry(maxRetries, currentAttempt + 1);
                }
                else {
                    this.logger.error(`[DEVICE STATUS CHECK ERROR] Max retries reached (${maxRetries}). Giving up.`);
                }
            }
            this.logger.error(`[DEVICE STATUS CHECK ERROR] ${error.message}`);
            this.logger.error(error.stack);
        }
    }
    async checkInfusionDataTimeoutWithRetry(maxRetries, currentAttempt = 1) {
        try {
            this.logger.log('[INFUSION TIMEOUT CHECK] Starting infusion data timeout check...');
            const assignmentRepository = this.dataSource.getRepository(patient_bed_assignment_entity_1.PatientBedAssignment);
            const deviceRepository = this.dataSource.getRepository(device_entity_1.Device);
            const logRepository = this.dataSource.getRepository(infusion_raw_log_entity_1.InfusionRawLog);
            const activeAssignments = await assignmentRepository
                .createQueryBuilder('assignment')
                .leftJoinAndSelect('assignment.device', 'device')
                .leftJoinAndSelect('assignment.bed', 'bed')
                .where('assignment.released_at IS NULL')
                .andWhere('assignment.device_id IS NOT NULL')
                .getMany();
            if (activeAssignments.length === 0) {
                this.logger.log('[INFUSION TIMEOUT CHECK] No active assignments found');
                return;
            }
            this.logger.log(`[INFUSION TIMEOUT CHECK] Found ${activeAssignments.length} active assignments`);
            const timeoutDate = new Date();
            timeoutDate.setSeconds(timeoutDate.getSeconds() - this.timeoutSeconds);
            let stopCount = 0;
            for (const assignment of activeAssignments) {
                if (!assignment.device_id) {
                    continue;
                }
                const device = await deviceRepository.findOne({
                    where: { id: assignment.device_id }
                });
                if (!device) {
                    this.logger.warn(`[INFUSION TIMEOUT CHECK] Device not found for assignment ${assignment.id}`);
                    continue;
                }
                const recentLog = await logRepository
                    .createQueryBuilder('log')
                    .where('log.sn = :sn', { sn: device.serial_number })
                    .andWhere('log.created_at >= :timeoutDate', { timeoutDate })
                    .orderBy('log.created_at', 'DESC')
                    .limit(1)
                    .getOne();
                if (assignment.assigned_at) {
                    const assignedAt = new Date(assignment.assigned_at);
                    const nowTime = new Date();
                    const timeDiffMinutes = (nowTime.getTime() - assignedAt.getTime()) / (1000 * 60);
                    if (timeDiffMinutes < 2) {
                        this.logger.log(`[INFUSION TIMEOUT CHECK] Skipping assignment ${assignment.id} - less than 2 minutes since assigned_at (${timeDiffMinutes.toFixed(1)} min)`);
                        continue;
                    }
                }
                if (!recentLog) {
                    const alreadyDisconnected = assignment.alert_type === 'disconnected';
                    if (!alreadyDisconnected) {
                        await assignmentRepository.update(assignment.id, {
                            alert_type: 'disconnected'
                        });
                        stopCount++;
                        this.logger.log(`[INFUSION TIMEOUT CHECK] Assignment ${assignment.id} set to DISCONNECTED - No data in last ${this.timeoutSeconds} seconds (device SN: ${device.serial_number})`);
                    }
                    else {
                        this.logger.log(`[INFUSION TIMEOUT CHECK] Assignment ${assignment.id} still DISCONNECTED, re-sending MQTT (device SN: ${device.serial_number})`);
                    }
                    const topic = `bed/${assignment.bed_id}/assignment/update`;
                    const payload = {
                        bed_id: assignment.bed_id,
                        assignment_id: assignment.id,
                        patient_id: assignment.patient_id,
                        alert_type: 'disconnected',
                        updated_at: new Date().toISOString()
                    };
                    this.mqttService.publishMessage(topic, payload);
                    this.logger.log(`[INFUSION TIMEOUT CHECK] Published MQTT to ${topic}, alert_type: disconnected`);
                }
            }
            this.logger.log(`[INFUSION TIMEOUT CHECK] Completed - ${stopCount} assignments set to disconnected`);
        }
        catch (error) {
            if (error.code === 'ECONNRESET' || error.errno === -54) {
                if (currentAttempt < maxRetries) {
                    this.logger.warn(`[INFUSION TIMEOUT CHECK] DB connection error, retrying... (${currentAttempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.checkInfusionDataTimeoutWithRetry(maxRetries, currentAttempt + 1);
                }
                else {
                    this.logger.error(`[INFUSION TIMEOUT CHECK ERROR] Max retries reached (${maxRetries}). Giving up.`);
                }
            }
            this.logger.error(`[INFUSION TIMEOUT CHECK ERROR] ${error.message}`);
            this.logger.error(error.stack);
        }
    }
    async updateMissingInfusionCchr() {
        await this.updateMissingInfusionCchrWithRetry(3);
    }
    async updateMissingInfusionCchrWithRetry(maxRetries, currentAttempt = 1) {
        try {
            this.logger.log('[CCHR UPDATE] Starting infusion_cchr update check...');
            const assignmentRepository = this.dataSource.getRepository(patient_bed_assignment_entity_1.PatientBedAssignment);
            const deviceRepository = this.dataSource.getRepository(device_entity_1.Device);
            const logRepository = this.dataSource.getRepository(infusion_raw_log_entity_1.InfusionRawLog);
            const targetAssignments = await assignmentRepository
                .createQueryBuilder('assignment')
                .where('assignment.released_at IS NULL')
                .andWhere('assignment.infusion_cchr = 0.00')
                .andWhere('assignment.device_id IS NOT NULL')
                .andWhere('assignment.assigned_at IS NOT NULL')
                .getMany();
            if (targetAssignments.length === 0) {
                this.logger.log('[CCHR UPDATE] No assignments found with infusion_cchr = 0.00');
                return;
            }
            this.logger.log(`[CCHR UPDATE] Found ${targetAssignments.length} assignments with infusion_cchr = 0.00`);
            let updateCount = 0;
            for (const assignment of targetAssignments) {
                const device = await deviceRepository.findOne({
                    where: { id: assignment.device_id }
                });
                if (!device) {
                    this.logger.warn(`[CCHR UPDATE] Device not found for assignment ${assignment.id}`);
                    continue;
                }
                const assignedAt = new Date(assignment.assigned_at);
                const now = new Date();
                const timeDiffMinutes = (now.getTime() - assignedAt.getTime()) / (1000 * 60);
                this.logger.log(`[CCHR UPDATE] Processing Assignment ${assignment.id}:`);
                this.logger.log(`  - device_id: ${assignment.device_id}`);
                this.logger.log(`  - serial_number: ${device.serial_number}`);
                this.logger.log(`  - assigned_at: ${assignedAt.toISOString()}`);
                this.logger.log(`  - time elapsed: ${timeDiffMinutes.toFixed(1)} minutes`);
                if (timeDiffMinutes < 2) {
                    this.logger.log(`[CCHR UPDATE] Assignment ${assignment.id} - Waiting for 2 minutes to collect data (${timeDiffMinutes.toFixed(1)}/2.0 minutes)`);
                    continue;
                }
                const cchrLogs = await logRepository
                    .createQueryBuilder('log')
                    .select('log.cchr')
                    .where('log.sn = :sn', { sn: device.serial_number })
                    .andWhere('log.created_at >= :assignedAt', { assignedAt })
                    .andWhere('log.cchr IS NOT NULL')
                    .andWhere('log.cchr > 0')
                    .orderBy('log.created_at', 'ASC')
                    .limit(20)
                    .getMany();
                this.logger.log(`  - found ${cchrLogs.length} cchr records`);
                if (cchrLogs.length === 0) {
                    this.logger.log(`[CCHR UPDATE] Assignment ${assignment.id} - No valid cchr data found in first 5 minutes`);
                    continue;
                }
                const cchrSum = cchrLogs.reduce((sum, log) => {
                    const cchrValue = Number(log.cchr);
                    return sum + (isNaN(cchrValue) ? 0 : cchrValue);
                }, 0);
                const cchrAverage = cchrSum / cchrLogs.length;
                if (isNaN(cchrAverage) || !isFinite(cchrAverage)) {
                    this.logger.error(`[CCHR UPDATE] Assignment ${assignment.id} - Invalid cchr average: ${cchrAverage}`);
                    continue;
                }
                const roundedCchr = Math.round(cchrAverage * 100) / 100;
                this.logger.log(`[CCHR UPDATE] Assignment ${assignment.id} - Calculated cchr average: ${roundedCchr} (from ${cchrLogs.length} samples)`);
                await assignmentRepository.update(assignment.id, {
                    infusion_cchr: roundedCchr
                });
                updateCount++;
                this.logger.log(`[CCHR UPDATE] Assignment ${assignment.id} updated - infusion_cchr: 0.00 → ${roundedCchr} (calculated from ${cchrLogs.length} samples)`);
            }
            this.logger.log(`[CCHR UPDATE] Completed - ${updateCount} assignments updated`);
        }
        catch (error) {
            if (error.code === 'ECONNRESET' || error.errno === -54) {
                if (currentAttempt < maxRetries) {
                    this.logger.warn(`[CCHR UPDATE] DB connection error, retrying... (${currentAttempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.updateMissingInfusionCchrWithRetry(maxRetries, currentAttempt + 1);
                }
                else {
                    this.logger.error(`[CCHR UPDATE ERROR] Max retries reached (${maxRetries}). Giving up.`);
                }
            }
            this.logger.error(`[CCHR UPDATE ERROR] ${error.message}`);
            this.logger.error(error.stack);
        }
    }
};
exports.DeviceStatusScheduler = DeviceStatusScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeviceStatusScheduler.prototype, "checkDeviceStatus", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeviceStatusScheduler.prototype, "checkInfusionDataTimeout", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeviceStatusScheduler.prototype, "updateMissingInfusionCchr", null);
exports.DeviceStatusScheduler = DeviceStatusScheduler = DeviceStatusScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => mqtt_service_1.MqttService))),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        mqtt_service_1.MqttService,
        config_1.ConfigService])
], DeviceStatusScheduler);
//# sourceMappingURL=device-status.scheduler.js.map