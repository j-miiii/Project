import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { UserSetting } from '../entities/user-setting.entity';
export declare class AuthService {
    private readonly jwtService;
    private readonly dataSource;
    constructor(jwtService: JwtService, dataSource: DataSource);
    private getUserRepository;
    private getAccessTokenRepository;
    private getUserSettingRepository;
    private getUserLockoutStatusRepository;
    private getUserLockoutLogRepository;
    signinUser(auth_id: string, password: string): Promise<{
        access_token: string;
        refresh_token: string;
        user: {
            id: number;
            email: string;
            role: string;
            nickname: string;
            hospital_id: number;
            ward_id: number;
            has_emr: boolean;
        };
        user_setting: UserSetting;
        ward_setting: any;
    }>;
    refreshToken(refreshToken: string): Promise<{
        access_token: string;
    }>;
    unlockAccount(userId: number, adminUserId: number): Promise<{
        message: string;
        user_id: number;
        unlocked_by: number;
    }>;
}
