import { DataSource } from 'typeorm';
import { DrugOrder } from '../entities/drug-order.entity';
import { PatientVital } from '../entities/patient-vital.entity';
export declare class EmrService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    getMyWard(userId: number): Promise<{
        success: boolean;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        data: {
            ward: {
                id: number;
                name: string;
                code: string;
            };
            rooms: any[];
        };
        message?: undefined;
    }>;
    getPatientOrders(patientId: number, query?: {
        dc_yn?: string;
        order_date?: string;
    }): Promise<{
        success: boolean;
        data: DrugOrder[];
    }>;
    getPatientVitals(patientId: number): Promise<{
        success: boolean;
        data: PatientVital[];
    }>;
}
