import { DataSource } from 'typeorm';
import { MqttService } from '../mqtt/mqtt.service';
export interface MonitoringFilters {
    hospitalId?: number;
    wardId?: number;
    roomIds?: number[];
}
export interface BedData {
    bed_id: number;
    bed_number: string;
    bed_status: string;
    patient_info?: {
        id: number;
        name: string;
        chart_number: string;
        gender: string | null;
        age: number | null;
    };
    assignments?: any[];
}
export interface RoomNurseData {
    id: number;
    nickname: string;
    employee_number: string | null;
    profile_image: string;
}
export interface RoomData {
    room_id: number;
    room_number: string;
    nurse: RoomNurseData | null;
    beds: BedData[];
}
export interface WardData {
    ward_id: number;
    ward_name: string;
    rooms: RoomData[];
}
export interface HospitalData {
    hospital_id: number;
    hospital_name: string;
    wards: WardData[];
}
export declare class MonitoringService {
    private readonly dataSource;
    private readonly mqttService;
    constructor(dataSource: DataSource, mqttService: MqttService);
    getBedInfo(bedId: number): Promise<{
        success: boolean;
        statusCode: number;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            bed: {
                id: number;
                bed_number: string;
                status: string;
            };
            room: {
                id: number;
                name: string;
            };
            ward: {
                id: number;
                name: string;
            };
            hospital: {
                id: number;
                name: string;
            };
            nurses: {
                id: number;
                nickname: string;
                auth_id: string;
                role: string;
            }[];
        };
        statusCode?: undefined;
        message?: undefined;
    }>;
    releaseBulkAssignments(assignmentIds: number[]): Promise<{
        success: boolean;
        message: string;
        data: {
            total: number;
            succeeded: number;
            failed: number;
            hasFailures: boolean;
            results: any[];
        };
    }>;
    clearInfusion(assignmentId: number): Promise<{
        success: boolean;
        statusCode: number;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        statusCode: number;
        message: string;
        data: {
            assignment_id: number;
        };
    }>;
    releaseAssignment(assignmentId: number): Promise<{
        success: boolean;
        statusCode: number;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        statusCode: number;
        message: string;
        data: {
            assignment_id: number;
            released_at: Date;
        };
    }>;
    getMonitoringData(filters: MonitoringFilters): Promise<{
        success: boolean;
        hospital_id: number;
        hospital_name: string;
        data: WardData[];
        timestamp: Date;
    } | {
        success: boolean;
        data: HospitalData[];
        timestamp: Date;
        hospital_id?: undefined;
        hospital_name?: undefined;
    }>;
    private sendAssignmentRefreshNotification;
    private sendBulkReleaseRefreshNotification;
}
