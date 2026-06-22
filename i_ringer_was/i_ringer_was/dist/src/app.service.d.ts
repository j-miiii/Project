import { DataSource } from 'typeorm';
import { MqttService } from './mqtt/mqtt.service';
import { FcmService } from './fcm/fcm.service';
export declare class AppService {
    private dataSource;
    private mqttService;
    private fcmService;
    private readonly logger;
    private entityMap;
    constructor(dataSource: DataSource, mqttService: MqttService, fcmService: FcmService);
    private deriveAlertCategory;
    private getRepository;
    findAll(tableName: string, query: any, authorization?: string): Promise<any>;
    findOne(tableName: string, id: number, userId?: number): Promise<any>;
    update(tableName: string, id: number, updateDto: any): Promise<any>;
    sendFcmTest(userId: number, title: string, body: string): Promise<any>;
    markAllNotificationsAsRead(userId: number): Promise<any>;
    remove(tableName: string, id: number): Promise<any>;
    insertData(tableName: string, data: any): Promise<any>;
    getAllHospitalsHierarchy(): Promise<any>;
    private processInfusionRawLog;
    private processIRDeviceData;
    private processLoadCellDeviceData;
    private createNotificationsByAlertType;
    private checkSpeedAlerts;
    private checkAndSendNotifications;
    testNotification(assignmentId: number, targetPercentage: number): Promise<{
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
    upsertPatientBedAssignment(data: any): Promise<any>;
    private sendAssignmentRefreshNotification;
    generateMockAssignment(hospitalId: number, wardId?: number): Promise<{
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
    addInfusion(data: {
        patient_id: number;
        bed_id: number;
        infusion_type: string;
        infusion_code?: string;
        infusion_id?: number;
        infusion_total_volume: number;
        infusion_gtt?: number;
        infusion_cchr?: number;
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
}
