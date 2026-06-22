import { StatisticsService } from './statistics.service';
export declare class StatisticsController {
    private readonly statisticsService;
    constructor(statisticsService: StatisticsService);
    getAllDashboard(start_date: string, end_date: string, hospital_id?: string, ward_id?: string, room_id?: string, granularity?: string): Promise<{
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
    getDeviceUsageDebug(device_id: string, start_date: string, end_date: string): Promise<{
        deviceId: number;
        records: any;
        totalRecords: any;
    }>;
}
