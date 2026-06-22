import { AppService } from './app.service';
import { CreateDeviceDto } from './dto/device.dto';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    findAll(tableName: string, query: any, authorization?: string): Promise<any>;
    findOne(tableName: string, id: number, userId?: number, authorization?: string): Promise<any>;
    update(tableName: string, id: number, updateDto: any, req: any): Promise<any>;
    remove(tableName: string, id: number, req: any): Promise<{
        message: string;
    }>;
    createUser(data: any): Promise<any>;
    createPatient(data: any): Promise<any>;
    createHospital(data: any): Promise<any>;
    createWard(data: any): Promise<any>;
    createRoom(data: any): Promise<any>;
    createBed(data: any): Promise<any>;
    createDevice(data: CreateDeviceDto): Promise<any>;
    createPatientBedAssignment(data: any): Promise<any>;
    upsertPatientBedAssignment(data: any): Promise<any>;
    createNotification(data: any): Promise<any>;
    createUserSetting(data: any): Promise<any>;
    createAccessToken(data: any): Promise<any>;
    createNurseRoomAssignment(data: any): Promise<any>;
    createTerm(data: any): Promise<any>;
    createUserTermAgreement(data: any): Promise<any>;
    createInfusion(data: any): Promise<any>;
    createDrugOrder(data: any): Promise<any>;
    createInfusionEventLog(data: any): Promise<any>;
    testNotification(data: {
        assignment_id: number;
        target_percentage: number;
    }): Promise<{
        success: boolean;
        message: string;
        data: {
            assignment_id: number;
            target_percentage: number;
            target_current_volume: number;
            total_volume: any;
            device_id: any;
            bed_id: any;
        };
    }>;
}
