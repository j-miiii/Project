import { AuthService } from './auth.service';
import { UserLoginDto } from '../dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
export declare class AuthController {
    private readonly authService;
    private readonly jwtService;
    constructor(authService: AuthService, jwtService: JwtService);
    signinUser(loginDto: UserLoginDto): Promise<{
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
        user_setting: import("../entities/user-setting.entity").UserSetting;
        ward_setting: any;
    }>;
    refresh(refreshToken: string): Promise<{
        access_token: string;
    }>;
    unlockAccount(authorization: string, userId: number): Promise<{
        message: string;
        user_id: number;
        unlocked_by: number;
    }>;
}
