import { AppService } from './app.service';
export declare class UnifiedController {
    private readonly appService;
    constructor(appService: AppService);
    findAll(tableName: string, query: any, authorization?: string): Promise<any>;
    findOne(tableName: string, id: string, userId?: number, authorization?: string): Promise<any>;
    sendFcmTest(body: {
        user_id: number;
        title: string;
        body: string;
    }): Promise<any>;
    markAllNotificationsAsRead(body: {
        user_id: number;
    }): Promise<any>;
    update(tableName: string, id: number, updateDto: any, req: any): Promise<any>;
    remove(tableName: string, id: number, req: any): Promise<{
        message: string;
    }>;
}
