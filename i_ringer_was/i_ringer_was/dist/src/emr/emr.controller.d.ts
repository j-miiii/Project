import { JwtService } from '@nestjs/jwt';
import { EmrService } from './emr.service';
export declare class EmrController {
    private readonly emrService;
    private readonly jwtService;
    constructor(emrService: EmrService, jwtService: JwtService);
    private extractUserId;
    getMyWard(authorization: string): Promise<{
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
    getPatientOrders(authorization: string, id: number, dcYn?: string, orderDate?: string): Promise<{
        success: boolean;
        data: import("../entities/drug-order.entity").DrugOrder[];
    }>;
    getPatientVitals(authorization: string, id: number): Promise<{
        success: boolean;
        data: import("../entities/patient-vital.entity").PatientVital[];
    }>;
}
