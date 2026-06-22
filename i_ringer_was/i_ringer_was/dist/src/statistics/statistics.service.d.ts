import { DataSource } from 'typeorm';
interface StatisticsQuery {
    start_date: string;
    end_date: string;
    hospital_id?: number;
    ward_id?: number;
    room_id?: number;
    granularity: 'daily' | 'weekly' | 'monthly' | 'yearly';
}
export declare class StatisticsService {
    private dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    getAllDashboardStatistics(query: StatisticsQuery): Promise<{
        kpiCards: {
            totalDevices: number;
            activeDevices: number;
            inactiveDevices: number;
            totalInfusions: number;
        };
        alarmFrequency: any;
        alarmResponseTime: {
            period: string;
        }[];
        infusionSummary: {
            totalVolume: number;
            averageDurationMinutes: number;
        };
        periodicalInfusionTotal: {
            period: string;
        }[];
        infusionTypeDistribution: any;
        batteryDistribution: any;
        deviceUsageTime: any;
    }>;
    private getKpiCards;
    private getAlarmFrequency;
    private getAlarmResponseTime;
    private getInfusionSummary;
    private getPeriodicalInfusionTotal;
    private getInfusionTypeDistribution;
    private getBatteryDistribution;
    private getDeviceUsageTime;
    getDeviceUsageDebug(deviceId: number, startDate: string, endDate: string): Promise<{
        deviceId: number;
        records: any;
        totalRecords: any;
    }>;
    private getDateFormat;
    private generateAllPeriods;
    private fillMissingPeriods;
}
export {};
