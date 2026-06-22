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
var StatisticsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let StatisticsService = StatisticsService_1 = class StatisticsService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(StatisticsService_1.name);
    }
    async getAllDashboardStatistics(query) {
        this.logger.log(`[STATISTICS] Fetching all dashboard data - hospital: ${query.hospital_id}, ward: ${query.ward_id || 'all'}, room: ${query.room_id || 'all'}, period: ${query.start_date} ~ ${query.end_date}, granularity: ${query.granularity}`);
        const adjustedQuery = {
            ...query,
            end_date: query.end_date.includes(':') ? query.end_date : `${query.end_date} 23:59:59`,
        };
        this.logger.debug(`[STATISTICS] Adjusted date range: ${adjustedQuery.start_date} ~ ${adjustedQuery.end_date}`);
        try {
            const [kpiCards, alarmFrequency, alarmResponseTime, infusionSummary, periodicalInfusionTotal, infusionTypeDistribution, batteryDistribution, deviceUsageTime,] = await Promise.all([
                this.getKpiCards(adjustedQuery),
                this.getAlarmFrequency(adjustedQuery),
                this.getAlarmResponseTime(adjustedQuery),
                this.getInfusionSummary(adjustedQuery),
                this.getPeriodicalInfusionTotal(adjustedQuery),
                this.getInfusionTypeDistribution(adjustedQuery),
                this.getBatteryDistribution(adjustedQuery.hospital_id),
                this.getDeviceUsageTime(adjustedQuery),
            ]);
            return {
                kpiCards,
                alarmFrequency,
                alarmResponseTime,
                infusionSummary,
                periodicalInfusionTotal,
                infusionTypeDistribution,
                batteryDistribution,
                deviceUsageTime,
            };
        }
        catch (error) {
            this.logger.error(`[STATISTICS ERROR] ${error.message}`);
            throw error;
        }
    }
    async getKpiCards(query) {
        this.logger.log(`[STATISTICS] Calculating KPI cards...`);
        let totalDevicesQuery = `
      SELECT COUNT(*) as count
      FROM devices d
    `;
        let activeDevicesQuery = `
      SELECT COUNT(*) as count
      FROM devices d
      WHERE d.network_status = 'online'
    `;
        let inactiveDevicesQuery = `
      SELECT COUNT(*) as count
      FROM devices d
      WHERE d.network_status = 'offline'
    `;
        let totalInfusionsQuery = `
      SELECT COUNT(*) as count
      FROM patient_bed_assignments pba
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE pba.assigned_at BETWEEN ? AND ?
        AND pba.device_id IS NOT NULL
        AND pba.released_at IS NULL
    `;
        const deviceParams = [];
        const infusionParams = [query.start_date, query.end_date];
        if (query.hospital_id) {
            totalDevicesQuery += ` WHERE d.hospital_id = ?`;
            activeDevicesQuery += ` AND d.hospital_id = ?`;
            inactiveDevicesQuery += ` AND d.hospital_id = ?`;
            totalInfusionsQuery += ` AND w.hospital_id = ?`;
            deviceParams.push(query.hospital_id);
            infusionParams.push(query.hospital_id);
        }
        if (query.ward_id) {
            if (query.hospital_id) {
                totalDevicesQuery += ` AND d.ward_id = ?`;
                activeDevicesQuery += ` AND d.ward_id = ?`;
                inactiveDevicesQuery += ` AND d.ward_id = ?`;
            }
            else {
                totalDevicesQuery += ` WHERE d.ward_id = ?`;
                activeDevicesQuery += ` AND d.ward_id = ?`;
                inactiveDevicesQuery += ` AND d.ward_id = ?`;
            }
            totalInfusionsQuery += ` AND w.id = ?`;
            deviceParams.push(query.ward_id);
            infusionParams.push(query.ward_id);
        }
        if (query.room_id) {
            if (query.hospital_id || query.ward_id) {
                totalDevicesQuery += ` AND d.room_id = ?`;
                activeDevicesQuery += ` AND d.room_id = ?`;
                inactiveDevicesQuery += ` AND d.room_id = ?`;
            }
            else {
                totalDevicesQuery += ` WHERE d.room_id = ?`;
                activeDevicesQuery += ` AND d.room_id = ?`;
                inactiveDevicesQuery += ` AND d.room_id = ?`;
            }
            totalInfusionsQuery += ` AND r.id = ?`;
            deviceParams.push(query.room_id);
            infusionParams.push(query.room_id);
        }
        const [totalDevices, activeDevices, inactiveDevices, totalInfusions] = await Promise.all([
            this.dataSource.query(totalDevicesQuery, deviceParams),
            this.dataSource.query(activeDevicesQuery, deviceParams),
            this.dataSource.query(inactiveDevicesQuery, deviceParams),
            this.dataSource.query(totalInfusionsQuery, infusionParams),
        ]);
        return {
            totalDevices: parseInt(totalDevices[0]?.count || 0),
            activeDevices: parseInt(activeDevices[0]?.count || 0),
            inactiveDevices: parseInt(inactiveDevices[0]?.count || 0),
            totalInfusions: parseInt(totalInfusions[0]?.count || 0),
        };
    }
    async getAlarmFrequency(query) {
        this.logger.log(`[STATISTICS] Calculating alarm frequency...`);
        let sql = `
      SELECT
        n.type,
        COUNT(*) as count
      FROM notifications n
      INNER JOIN patient_bed_assignments pba ON n.patient_bed_assignment_id = pba.id
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE n.created_at BETWEEN ? AND ?
    `;
        const params = [query.start_date, query.end_date];
        if (query.hospital_id) {
            sql += ` AND w.hospital_id = ?`;
            params.push(query.hospital_id);
        }
        if (query.ward_id) {
            sql += ` AND w.id = ?`;
            params.push(query.ward_id);
        }
        if (query.room_id) {
            sql += ` AND r.id = ?`;
            params.push(query.room_id);
        }
        sql += ` GROUP BY n.type`;
        const result = await this.dataSource.query(sql, params);
        return result.map(row => ({
            type: row.type,
            count: parseInt(row.count),
        }));
    }
    async getAlarmResponseTime(query) {
        this.logger.log(`[STATISTICS] Calculating alarm response time...`);
        const dateFormat = this.getDateFormat(query.granularity);
        let sql = `
      SELECT
        ${dateFormat} as period,
        MIN(TIMESTAMPDIFF(SECOND, n.created_at, n.read_at)) as min_response_time,
        AVG(TIMESTAMPDIFF(SECOND, n.created_at, n.read_at)) as avg_response_time,
        MAX(TIMESTAMPDIFF(SECOND, n.created_at, n.read_at)) as max_response_time
      FROM notifications n
      INNER JOIN patient_bed_assignments pba ON n.patient_bed_assignment_id = pba.id
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE n.created_at BETWEEN ? AND ?
        AND n.read_at IS NOT NULL
    `;
        const params = [query.start_date, query.end_date];
        if (query.hospital_id) {
            sql += ` AND w.hospital_id = ?`;
            params.push(query.hospital_id);
        }
        if (query.ward_id) {
            sql += ` AND w.id = ?`;
            params.push(query.ward_id);
        }
        if (query.room_id) {
            sql += ` AND r.id = ?`;
            params.push(query.room_id);
        }
        sql += ` GROUP BY period ORDER BY period`;
        this.logger.debug(`[ALARM_RESPONSE_TIME] Query: ${sql}`);
        this.logger.debug(`[ALARM_RESPONSE_TIME] Params: ${JSON.stringify(params)}`);
        const result = await this.dataSource.query(sql, params);
        this.logger.debug(`[ALARM_RESPONSE_TIME] Result count: ${result.length}`);
        this.logger.debug(`[ALARM_RESPONSE_TIME] Result: ${JSON.stringify(result)}`);
        const actualData = result.map(row => ({
            period: row.period,
            minResponseTime: parseFloat(row.min_response_time || 0),
            avgResponseTime: parseFloat(row.avg_response_time || 0),
            maxResponseTime: parseFloat(row.max_response_time || 0),
        }));
        const allPeriods = this.generateAllPeriods(query.start_date, query.end_date, query.granularity);
        return this.fillMissingPeriods(allPeriods, actualData, {
            minResponseTime: 0,
            avgResponseTime: 0,
            maxResponseTime: 0,
        });
    }
    async getInfusionSummary(query) {
        this.logger.log(`[STATISTICS] Calculating infusion summary...`);
        let totalVolumeQuery = `
      SELECT SUM(pba.infusion_current_volume) as total_volume
      FROM patient_bed_assignments pba
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE pba.assigned_at BETWEEN ? AND ?
        AND pba.device_id IS NOT NULL
    `;
        let avgDurationQuery = `
      SELECT AVG(TIMESTAMPDIFF(MINUTE, pba.assigned_at, pba.released_at)) as avg_duration
      FROM patient_bed_assignments pba
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE pba.assigned_at BETWEEN ? AND ?
        AND pba.device_id IS NOT NULL
        AND pba.assigned_at IS NOT NULL
        AND pba.released_at IS NOT NULL
    `;
        const params = [query.start_date, query.end_date];
        if (query.hospital_id) {
            totalVolumeQuery += ` AND w.hospital_id = ?`;
            avgDurationQuery += ` AND w.hospital_id = ?`;
            params.push(query.hospital_id);
        }
        if (query.ward_id) {
            totalVolumeQuery += ` AND w.id = ?`;
            avgDurationQuery += ` AND w.id = ?`;
            params.push(query.ward_id);
        }
        if (query.room_id) {
            totalVolumeQuery += ` AND r.id = ?`;
            avgDurationQuery += ` AND r.id = ?`;
            params.push(query.room_id);
        }
        this.logger.debug(`[INFUSION_SUMMARY] Total Volume Query: ${totalVolumeQuery}`);
        this.logger.debug(`[INFUSION_SUMMARY] Avg Duration Query: ${avgDurationQuery}`);
        this.logger.debug(`[INFUSION_SUMMARY] Params: ${JSON.stringify(params)}`);
        const [totalVolumeResult, avgDurationResult] = await Promise.all([
            this.dataSource.query(totalVolumeQuery, params),
            this.dataSource.query(avgDurationQuery, params),
        ]);
        this.logger.debug(`[INFUSION_SUMMARY] Total Volume Result: ${JSON.stringify(totalVolumeResult)}`);
        this.logger.debug(`[INFUSION_SUMMARY] Avg Duration Result: ${JSON.stringify(avgDurationResult)}`);
        return {
            totalVolume: parseFloat(totalVolumeResult[0]?.total_volume || 0),
            averageDurationMinutes: parseFloat(avgDurationResult[0]?.avg_duration || 0),
        };
    }
    async getPeriodicalInfusionTotal(query) {
        this.logger.log(`[STATISTICS] Calculating periodical infusion total...`);
        const dateFormat = this.getDateFormat(query.granularity, 'pba.assigned_at');
        let sql = `
      SELECT
        ${dateFormat} as period,
        SUM(pba.infusion_current_volume) as total_volume
      FROM patient_bed_assignments pba
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE pba.assigned_at BETWEEN ? AND ?
        AND pba.device_id IS NOT NULL
    `;
        const params = [query.start_date, query.end_date];
        if (query.hospital_id) {
            sql += ` AND w.hospital_id = ?`;
            params.push(query.hospital_id);
        }
        if (query.ward_id) {
            sql += ` AND w.id = ?`;
            params.push(query.ward_id);
        }
        if (query.room_id) {
            sql += ` AND r.id = ?`;
            params.push(query.room_id);
        }
        sql += ` GROUP BY period ORDER BY period`;
        this.logger.debug(`[PERIODICAL_INFUSION] Query: ${sql}`);
        this.logger.debug(`[PERIODICAL_INFUSION] Params: ${JSON.stringify(params)}`);
        const result = await this.dataSource.query(sql, params);
        this.logger.debug(`[PERIODICAL_INFUSION] Result count: ${result.length}`);
        this.logger.debug(`[PERIODICAL_INFUSION] Result: ${JSON.stringify(result)}`);
        const actualData = result.map(row => ({
            period: row.period,
            totalVolume: parseFloat(row.total_volume || 0),
        }));
        const allPeriods = this.generateAllPeriods(query.start_date, query.end_date, query.granularity);
        return this.fillMissingPeriods(allPeriods, actualData, { totalVolume: 0 });
    }
    async getInfusionTypeDistribution(query) {
        this.logger.log(`[STATISTICS] Calculating infusion type distribution...`);
        let subqueryCondition = `pba2.assigned_at BETWEEN ? AND ? AND pba2.device_id IS NOT NULL`;
        const subqueryParams = [query.start_date, query.end_date];
        if (query.hospital_id) {
            subqueryCondition = `w2.hospital_id = ? AND ` + subqueryCondition;
            subqueryParams.unshift(query.hospital_id);
        }
        if (query.ward_id) {
            subqueryCondition += ` AND w2.id = ?`;
            subqueryParams.push(query.ward_id);
        }
        if (query.room_id) {
            subqueryCondition += ` AND r2.id = ?`;
            subqueryParams.push(query.room_id);
        }
        let sql = `
      SELECT
        pba.infusion_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (
          SELECT COUNT(*)
          FROM patient_bed_assignments pba2
          INNER JOIN beds b2 ON pba2.bed_id = b2.id
          INNER JOIN rooms r2 ON b2.room_id = r2.id
          INNER JOIN wards w2 ON r2.ward_id = w2.id
          WHERE ${subqueryCondition}
        ), 2) as percentage
      FROM patient_bed_assignments pba
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE pba.assigned_at BETWEEN ? AND ?
        AND pba.device_id IS NOT NULL
    `;
        const params = [...subqueryParams, query.start_date, query.end_date];
        if (query.hospital_id) {
            sql += ` AND w.hospital_id = ?`;
            params.push(query.hospital_id);
        }
        if (query.ward_id) {
            sql += ` AND w.id = ?`;
            params.push(query.ward_id);
        }
        if (query.room_id) {
            sql += ` AND r.id = ?`;
            params.push(query.room_id);
        }
        sql += ` GROUP BY pba.infusion_type`;
        const result = await this.dataSource.query(sql, params);
        return result.map((row) => ({
            type: row.infusion_type || 'unknown',
            count: parseInt(row.count),
            percentage: parseFloat(row.percentage || 0),
        }));
    }
    async getBatteryDistribution(hospital_id) {
        this.logger.log(`[STATISTICS] Calculating battery distribution...`);
        let subqueryCondition = '';
        let mainCondition = '';
        const params = [];
        if (hospital_id) {
            subqueryCondition = 'WHERE w2.hospital_id = ?';
            mainCondition = 'WHERE w.hospital_id = ?';
            params.push(hospital_id, hospital_id);
        }
        const sql = `
      SELECT
        CASE
          WHEN d.battery_percent BETWEEN 81 AND 100 THEN '81-100%'
          WHEN d.battery_percent BETWEEN 51 AND 80 THEN '51-80%'
          WHEN d.battery_percent BETWEEN 21 AND 50 THEN '21-50%'
          ELSE '0-20%'
        END as battery_range,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (
          SELECT COUNT(*)
          FROM devices d2
          LEFT JOIN beds b2 ON d2.bed_id = b2.id
          LEFT JOIN rooms r2 ON b2.room_id = r2.id
          LEFT JOIN wards w2 ON r2.ward_id = w2.id
          ${subqueryCondition}
        ), 2) as percentage
      FROM devices d
      LEFT JOIN beds b ON d.bed_id = b.id
      LEFT JOIN rooms r ON b.room_id = r.id
      LEFT JOIN wards w ON r.ward_id = w.id
      ${mainCondition}
      GROUP BY battery_range
      ORDER BY battery_range DESC
    `;
        const result = await this.dataSource.query(sql, params);
        return result.map((row) => ({
            range: row.battery_range,
            count: parseInt(row.count),
            percentage: parseFloat(row.percentage || 0),
        }));
    }
    async getDeviceUsageTime(query) {
        this.logger.log(`[STATISTICS] Calculating device usage time...`);
        let sql = `
      SELECT
        pba.device_id,
        d.device_name,
        ROUND(SUM(TIMESTAMPDIFF(SECOND, pba.assigned_at, pba.released_at)) / 3600.0, 4) as total_hours
      FROM patient_bed_assignments pba
      INNER JOIN devices d ON pba.device_id = d.id
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE pba.assigned_at BETWEEN ? AND ?
        AND pba.assigned_at IS NOT NULL
        AND pba.released_at IS NOT NULL
    `;
        const params = [query.start_date, query.end_date];
        if (query.hospital_id) {
            sql += ` AND w.hospital_id = ?`;
            params.push(query.hospital_id);
        }
        if (query.ward_id) {
            sql += ` AND w.id = ?`;
            params.push(query.ward_id);
        }
        if (query.room_id) {
            sql += ` AND r.id = ?`;
            params.push(query.room_id);
        }
        sql += ` GROUP BY pba.device_id, d.device_name ORDER BY total_hours DESC`;
        const result = await this.dataSource.query(sql, params);
        return result.map((row) => ({
            deviceId: row.device_id,
            deviceName: row.device_name,
            totalHours: parseFloat(row.total_hours || 0),
        }));
    }
    async getDeviceUsageDebug(deviceId, startDate, endDate) {
        const sql = `
      SELECT
        pba.id,
        pba.device_id,
        d.device_name,
        pba.assigned_at,
        pba.released_at,
        TIMESTAMPDIFF(SECOND, pba.assigned_at, pba.released_at) as seconds_diff,
        ROUND(TIMESTAMPDIFF(SECOND, pba.assigned_at, pba.released_at) / 3600.0, 4) as hours_diff
      FROM patient_bed_assignments pba
      INNER JOIN devices d ON pba.device_id = d.id
      WHERE pba.device_id = ?
        AND pba.assigned_at BETWEEN ? AND ?
        AND pba.assigned_at IS NOT NULL
        AND pba.released_at IS NOT NULL
      ORDER BY pba.assigned_at DESC
    `;
        const result = await this.dataSource.query(sql, [deviceId, startDate, endDate]);
        return {
            deviceId,
            records: result,
            totalRecords: result.length,
        };
    }
    getDateFormat(granularity, columnName = 'n.created_at') {
        switch (granularity) {
            case 'daily':
                return `DATE_FORMAT(${columnName}, '%Y-%m-%d')`;
            case 'weekly':
                return `CONCAT(
          DATE_FORMAT(${columnName}, '%Y-%m-'),
          FLOOR((DAYOFMONTH(${columnName}) - 1 +
            (CASE WHEN DAYOFWEEK(DATE_FORMAT(${columnName}, '%Y-%m-01')) = 1 THEN 6
                  ELSE DAYOFWEEK(DATE_FORMAT(${columnName}, '%Y-%m-01')) - 2 END)
          ) / 7) + 1
        )`;
            case 'monthly':
                return `DATE_FORMAT(${columnName}, '%Y-%m')`;
            case 'yearly':
                return `DATE_FORMAT(${columnName}, '%Y')`;
            default:
                return `DATE_FORMAT(${columnName}, '%Y-%m-%d')`;
        }
    }
    generateAllPeriods(startDate, endDate, granularity) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const periods = [];
        switch (granularity) {
            case 'daily': {
                const current = new Date(start);
                while (current <= end) {
                    const year = current.getFullYear();
                    const month = String(current.getMonth() + 1).padStart(2, '0');
                    const day = String(current.getDate()).padStart(2, '0');
                    periods.push(`${year}-${month}-${day}`);
                    current.setDate(current.getDate() + 1);
                }
                break;
            }
            case 'weekly': {
                const getMonthWeekNumber = (date) => {
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1;
                    const day = date.getDate();
                    const firstDayOfMonth = new Date(year, month - 1, 1);
                    const firstDayWeekday = firstDayOfMonth.getDay();
                    const offset = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;
                    const weekOfMonth = Math.floor((day - 1 + offset) / 7) + 1;
                    return `${year}-${String(month).padStart(2, '0')}-${weekOfMonth}`;
                };
                const current = new Date(start);
                const periodSet = new Set();
                while (current <= end) {
                    periodSet.add(getMonthWeekNumber(current));
                    current.setDate(current.getDate() + 1);
                }
                periods.push(...Array.from(periodSet).sort());
                break;
            }
            case 'monthly': {
                const current = new Date(start);
                while (current <= end) {
                    const year = current.getFullYear();
                    const month = String(current.getMonth() + 1).padStart(2, '0');
                    periods.push(`${year}-${month}`);
                    current.setMonth(current.getMonth() + 1);
                }
                break;
            }
            case 'yearly': {
                const startYear = start.getFullYear();
                const endYear = end.getFullYear();
                for (let year = startYear; year <= endYear; year++) {
                    periods.push(String(year));
                }
                break;
            }
        }
        return periods;
    }
    fillMissingPeriods(allPeriods, actualData, defaultValues) {
        const dataMap = new Map();
        actualData.forEach(item => {
            dataMap.set(item.period, item);
        });
        return allPeriods.map(period => {
            return dataMap.get(period) || { period, ...defaultValues };
        });
    }
};
exports.StatisticsService = StatisticsService;
exports.StatisticsService = StatisticsService = StatisticsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], StatisticsService);
//# sourceMappingURL=statistics.service.js.map