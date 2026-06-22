import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface StatisticsQuery {
  start_date: string;
  end_date: string;
  hospital_id?: number;
  ward_id?: number;
  room_id?: number;
  granularity: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * 통계 페이지 All-in-One API
   * 모든 통계 데이터를 한 번에 반환
   */
  async getAllDashboardStatistics(query: StatisticsQuery) {
    this.logger.log(`[STATISTICS] Fetching all dashboard data - hospital: ${query.hospital_id}, ward: ${query.ward_id || 'all'}, room: ${query.room_id || 'all'}, period: ${query.start_date} ~ ${query.end_date}, granularity: ${query.granularity}`);

    // end_date를 하루의 끝(23:59:59)까지 포함하도록 수정
    const adjustedQuery = {
      ...query,
      end_date: query.end_date.includes(':') ? query.end_date : `${query.end_date} 23:59:59`,
    };

    this.logger.debug(`[STATISTICS] Adjusted date range: ${adjustedQuery.start_date} ~ ${adjustedQuery.end_date}`);

    try {
      const [
        kpiCards,
        alarmFrequency,
        alarmResponseTime,
        infusionSummary,
        periodicalInfusionTotal,
        infusionTypeDistribution,
        batteryDistribution,
        deviceUsageTime,
      ] = await Promise.all([
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
    } catch (error) {
      this.logger.error(`[STATISTICS ERROR] ${error.message}`);
      throw error;
    }
  }

  /**
   * [작업 1] 상단 4개 KPI 카드
   */
  private async getKpiCards(query: StatisticsQuery) {
    this.logger.log(`[STATISTICS] Calculating KPI cards...`);

    // totalDevices: devices 테이블의 hospital_id, ward_id로 필터링
    let totalDevicesQuery = `
      SELECT COUNT(*) as count
      FROM devices d
    `;

    // activeDevices: network_status = 'online'
    let activeDevicesQuery = `
      SELECT COUNT(*) as count
      FROM devices d
      WHERE d.network_status = 'online'
    `;

    // inactiveDevices: network_status = 'offline'
    let inactiveDevicesQuery = `
      SELECT COUNT(*) as count
      FROM devices d
      WHERE d.network_status = 'offline'
    `;

    // totalInfusions: assigned_at이 기간 내이고 device_id가 있고 released_at이 NULL인 경우 (진행 중인 투여)
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

    const deviceParams: any[] = [];
    const infusionParams: any[] = [query.start_date, query.end_date];

    // hospital_id 필터링
    if (query.hospital_id) {
      // devices 쿼리: d.hospital_id로 필터링
      totalDevicesQuery += ` WHERE d.hospital_id = ?`;
      activeDevicesQuery += ` AND d.hospital_id = ?`;
      inactiveDevicesQuery += ` AND d.hospital_id = ?`;

      // totalInfusions: bed_id 역추적으로 필터링
      totalInfusionsQuery += ` AND w.hospital_id = ?`;

      deviceParams.push(query.hospital_id);
      infusionParams.push(query.hospital_id);
    }

    // ward_id 필터링
    if (query.ward_id) {
      // devices 쿼리: d.ward_id로 필터링
      if (query.hospital_id) {
        totalDevicesQuery += ` AND d.ward_id = ?`;
        activeDevicesQuery += ` AND d.ward_id = ?`;
        inactiveDevicesQuery += ` AND d.ward_id = ?`;
      } else {
        totalDevicesQuery += ` WHERE d.ward_id = ?`;
        activeDevicesQuery += ` AND d.ward_id = ?`;
        inactiveDevicesQuery += ` AND d.ward_id = ?`;
      }

      // totalInfusions: bed_id 역추적으로 필터링
      totalInfusionsQuery += ` AND w.id = ?`;

      deviceParams.push(query.ward_id);
      infusionParams.push(query.ward_id);
    }

    // room_id 필터링
    if (query.room_id) {
      // devices 쿼리: d.room_id로 필터링
      if (query.hospital_id || query.ward_id) {
        totalDevicesQuery += ` AND d.room_id = ?`;
        activeDevicesQuery += ` AND d.room_id = ?`;
        inactiveDevicesQuery += ` AND d.room_id = ?`;
      } else {
        totalDevicesQuery += ` WHERE d.room_id = ?`;
        activeDevicesQuery += ` AND d.room_id = ?`;
        inactiveDevicesQuery += ` AND d.room_id = ?`;
      }

      // totalInfusions: bed_id 역추적으로 필터링
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

  /**
   * [작업 2] 알람 유형별 발생 빈도
   */
  private async getAlarmFrequency(query: StatisticsQuery) {
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

    const params: any[] = [query.start_date, query.end_date];

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

  /**
   * [작업 3] 알람 반응 시간 (granularity 적용)
   */
  private async getAlarmResponseTime(query: StatisticsQuery) {
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

    const params: any[] = [query.start_date, query.end_date];

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

    // 디버그 로그 추가
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

    // 시작일-종료일 사이의 모든 기간 생성
    const allPeriods = this.generateAllPeriods(query.start_date, query.end_date, query.granularity);

    // 빈 기간을 0으로 채워서 반환
    return this.fillMissingPeriods(allPeriods, actualData, {
      minResponseTime: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
    });
  }

  /**
   * [작업 4] 총 투여량 & 평균 투여 시간
   */
  private async getInfusionSummary(query: StatisticsQuery) {
    this.logger.log(`[STATISTICS] Calculating infusion summary...`);

    // 총 투여량 (실제 투여한 용량)
    let totalVolumeQuery = `
      SELECT SUM(pba.infusion_current_volume) as total_volume
      FROM patient_bed_assignments pba
      INNER JOIN beds b ON pba.bed_id = b.id
      INNER JOIN rooms r ON b.room_id = r.id
      INNER JOIN wards w ON r.ward_id = w.id
      WHERE pba.assigned_at BETWEEN ? AND ?
        AND pba.device_id IS NOT NULL
    `;

    // 평균 투여 시간 (분 단위)
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

    const params: any[] = [query.start_date, query.end_date];

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

    // 디버그 로그 추가
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

  /**
   * [작업 5] 주기별 투여 총량 (granularity 적용)
   */
  private async getPeriodicalInfusionTotal(query: StatisticsQuery) {
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

    const params: any[] = [query.start_date, query.end_date];

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

    // 디버그 로그 추가
    this.logger.debug(`[PERIODICAL_INFUSION] Query: ${sql}`);
    this.logger.debug(`[PERIODICAL_INFUSION] Params: ${JSON.stringify(params)}`);

    const result = await this.dataSource.query(sql, params);

    this.logger.debug(`[PERIODICAL_INFUSION] Result count: ${result.length}`);
    this.logger.debug(`[PERIODICAL_INFUSION] Result: ${JSON.stringify(result)}`);

    const actualData = result.map(row => ({
      period: row.period,
      totalVolume: parseFloat(row.total_volume || 0),
    }));

    // 시작일-종료일 사이의 모든 기간 생성
    const allPeriods = this.generateAllPeriods(query.start_date, query.end_date, query.granularity);

    // 빈 기간을 0으로 채워서 반환
    return this.fillMissingPeriods(allPeriods, actualData, { totalVolume: 0 });
  }

  /**
   * [작업 6-1] 수액 종류별 투여량 분포
   */
  private async getInfusionTypeDistribution(query: StatisticsQuery) {
    this.logger.log(`[STATISTICS] Calculating infusion type distribution...`);

    // 서브쿼리 조건 구성
    let subqueryCondition = `pba2.assigned_at BETWEEN ? AND ? AND pba2.device_id IS NOT NULL`;
    const subqueryParams: any[] = [query.start_date, query.end_date];

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

    const params: any[] = [...subqueryParams, query.start_date, query.end_date];

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

    return result.map((row: any) => ({
      type: row.infusion_type || 'unknown',
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage || 0),
    }));
  }

  /**
   * [작업 6-2] 배터리 잔량 분포
   */
  private async getBatteryDistribution(hospital_id?: number) {
    this.logger.log(`[STATISTICS] Calculating battery distribution...`);

    let subqueryCondition = '';
    let mainCondition = '';
    const params: any[] = [];

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

    return result.map((row: any) => ({
      range: row.battery_range,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage || 0),
    }));
  }

  /**
   * [작업 7] 기기별 사용 시간
   */
  private async getDeviceUsageTime(query: StatisticsQuery) {
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

    const params: any[] = [query.start_date, query.end_date];

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

    return result.map((row: any) => ({
      deviceId: row.device_id,
      deviceName: row.device_name,
      totalHours: parseFloat(row.total_hours || 0),
    }));
  }

  /**
   * 디버그용: 특정 기기의 상세 사용 데이터 조회
   */
  async getDeviceUsageDebug(deviceId: number, startDate: string, endDate: string) {
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

  /**
   * granularity에 따른 날짜 포맷 반환
   */
  private getDateFormat(granularity: string, columnName: string = 'n.created_at'): string {
    switch (granularity) {
      case 'daily':
        return `DATE_FORMAT(${columnName}, '%Y-%m-%d')`;
      case 'weekly':
        // 월 단위 주차: 각 월의 1일이 속한 주를 1주차로 계산 (월요일 시작)
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

  /**
   * 시작일-종료일 사이의 모든 기간을 생성
   */
  private generateAllPeriods(startDate: string, endDate: string, granularity: string): string[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periods: string[] = [];

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
        // 월 단위 주차: 각 월의 1일이 속한 주를 1주차로 계산 (월요일 시작)
        const getMonthWeekNumber = (date: Date): string => {
          const year = date.getFullYear();
          const month = date.getMonth() + 1; // 1-12
          const day = date.getDate();

          // 해당 월의 1일
          const firstDayOfMonth = new Date(year, month - 1, 1);
          // 1일의 요일 (0=일요일, 1=월요일, ..., 6=토요일)
          const firstDayWeekday = firstDayOfMonth.getDay();
          // 월요일 기준으로 1일이 속한 주의 오프셋 계산
          // 일요일=6, 월요일=0, 화요일=1, ..., 토요일=5
          const offset = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

          // 해당 날짜가 속한 월의 주차 계산
          const weekOfMonth = Math.floor((day - 1 + offset) / 7) + 1;

          return `${year}-${String(month).padStart(2, '0')}-${weekOfMonth}`;
        };

        const current = new Date(start);
        const periodSet = new Set<string>();

        // 시작일부터 종료일까지 모든 날짜를 순회하며 주차 수집
        while (current <= end) {
          periodSet.add(getMonthWeekNumber(current));
          current.setDate(current.getDate() + 1);
        }

        // 정렬하여 periods에 추가
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

  /**
   * 실제 데이터와 빈 기간을 병합하여 모든 기간의 데이터 반환
   */
  private fillMissingPeriods<T extends { period: string }>(
    allPeriods: string[],
    actualData: T[],
    defaultValues: Omit<T, 'period'>,
  ): T[] {
    const dataMap = new Map<string, T>();

    // 실제 데이터를 맵에 저장
    actualData.forEach(item => {
      dataMap.set(item.period, item);
    });

    // 모든 기간에 대해 데이터 생성 (없으면 기본값 사용)
    return allPeriods.map(period => {
      return dataMap.get(period) || ({ period, ...defaultValues } as T);
    });
  }
}
