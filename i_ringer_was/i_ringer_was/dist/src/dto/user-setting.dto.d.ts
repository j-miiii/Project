export declare class CreateUserSettingDto {
    user_id: number;
    fast_enabled?: boolean;
    fast_threshold?: number;
    slow_enabled?: boolean;
    slow_threshold?: number;
    default_gatt?: number;
    default_cchr?: number;
    complete_enabled?: boolean;
    complete_threshold?: number;
    stop_enabled?: boolean;
    alert_color?: string;
    alert_display_time?: number;
    critical_alert_enabled?: number;
    critical_sound_enabled?: number;
    critical_sound_volume?: number;
    caution_alert_enabled?: number;
    caution_sound_enabled?: number;
    caution_sound_volume?: number;
    system_error_alert_enabled?: number;
    system_error_sound_enabled?: number;
    system_error_sound_volume?: number;
    volume_display_mode?: string;
}
declare const UpdateUserSettingDto_base: import("@nestjs/common").Type<Partial<CreateUserSettingDto>>;
export declare class UpdateUserSettingDto extends UpdateUserSettingDto_base {
}
export {};
