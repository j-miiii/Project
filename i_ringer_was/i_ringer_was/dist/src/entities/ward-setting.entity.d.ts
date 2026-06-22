import { Ward } from './ward.entity';
export declare class WardSetting {
    id: number;
    ward_id: number;
    fast_enabled: number;
    fast_threshold: number;
    slow_enabled: number;
    slow_threshold: number;
    complete_enabled: number;
    complete_threshold: number;
    stop_enabled: number;
    default_gatt: number;
    default_cchr: number;
    created_at: Date;
    updated_at: Date;
    ward: Ward;
}
