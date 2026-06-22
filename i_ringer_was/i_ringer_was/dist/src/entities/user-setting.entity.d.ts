import { User } from './user.entity';
export declare class UserSetting {
    id: number;
    user_id: number;
    fast_enabled: number;
    fast_threshold: number;
    slow_enabled: number;
    slow_threshold: number;
    default_gatt: number;
    default_cchr: number;
    complete_enabled: number;
    complete_threshold: number;
    stop_enabled: number;
    alert_color: string;
    alert_display_time: number;
    critical_alert_enabled: number;
    critical_sound_enabled: number;
    critical_sound_volume: number;
    caution_alert_enabled: number;
    caution_sound_enabled: number;
    caution_sound_volume: number;
    system_error_alert_enabled: number;
    system_error_sound_enabled: number;
    system_error_sound_volume: number;
    volume_display_mode: string;
    created_at: Date;
    updated_at: Date;
    user: User;
}
