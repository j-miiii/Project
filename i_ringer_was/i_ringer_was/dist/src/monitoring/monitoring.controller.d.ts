import { MonitoringService } from './monitoring.service';
import { AppService } from '../app.service';
import { BulkReleaseDto } from '../dto/patient-bed-assignment.dto';
export declare class MonitoringController {
    private readonly monitoringService;
    private readonly appService;
    constructor(monitoringService: MonitoringService, appService: AppService);
    getAllHospitalsHierarchy(): Promise<any>;
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
    getMonitoringData(hospitalId?: number, wardId?: number, roomIds?: string): Promise<{
        success: boolean;
        hospital_id: number;
        hospital_name: string;
        data: import("./monitoring.service").WardData[];
        timestamp: Date;
    } | {
        success: boolean;
        data: import("./monitoring.service").HospitalData[];
        timestamp: Date;
        hospital_id?: undefined;
        hospital_name?: undefined;
    }>;
    releaseBulkAssignments(bulkReleaseDto: BulkReleaseDto): Promise<{
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
    clearInfusion(id: number): Promise<{
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
    releaseAssignment(id: number): Promise<{
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
    addInfusion(data: {
        patient_id: number;
        bed_id: number;
        infusion_type: string;
        infusion_code?: string;
        infusion_id?: number;
        infusion_total_volume: number;
        infusion_cchr: number;
        drug_order_id?: number;
    }): Promise<{
        success: boolean;
        message: string;
        data: {
            assignment_id: any;
            patient_id: number;
            bed_id: number;
            infusion_id: any;
            infusion_type: any;
            infusion_code: any;
            total_volume: any;
            cchr: any;
            status: any;
            active_infusion_count: number;
        };
    }>;
    generateMockAssignment(data: {
        hospital_id: number;
        ward_id?: number;
    }): Promise<{
        success: boolean;
        statusCode: number;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        message: string;
        data: {
            patient: {
                id: any;
                name: any;
                chart_number: any;
                sex: string;
                age: number;
            };
            bed: {
                id: any;
                bed_number: any;
            };
            room: {
                id: number;
                name: string;
            };
            assignments: {
                assignment_id: any;
                infusion_id: any;
                infusion_type: any;
                infusion_code: any;
                total_volume: any;
                current_volume: any;
                cchr: any;
                status: any;
            }[];
        };
        statusCode?: undefined;
    }>;
}
