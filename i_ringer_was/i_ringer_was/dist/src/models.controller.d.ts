import { AppService } from './app.service';
export declare class ModelsController {
    private readonly appService;
    constructor(appService: AppService);
    createUser(data: any): Promise<any>;
    createPatient(data: any): Promise<any>;
    createHospital(data: any): Promise<any>;
    createWard(data: any): Promise<any>;
    createRoom(data: any): Promise<any>;
    createBed(data: any): Promise<any>;
    createDevice(data: any): Promise<any>;
    createPatientBedAssignment(data: any): Promise<any>;
    createInfusionRawLog(data: any): Promise<any>;
    createNotification(data: any): Promise<any>;
    createUserSetting(data: any): Promise<any>;
    createAccessToken(data: any): Promise<any>;
    createInfusion(data: any): Promise<any>;
    createDrugOrder(data: any): Promise<any>;
    createPatientVital(data: any): Promise<any>;
    createNurseRoomAssignment(data: any): Promise<any>;
    createTerm(data: any): Promise<any>;
    createUserTermAgreement(data: any): Promise<any>;
    createInfusionEventLog(data: any): Promise<any>;
}
