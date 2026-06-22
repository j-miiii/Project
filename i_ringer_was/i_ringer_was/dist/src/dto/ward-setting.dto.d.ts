export declare class CreateWardSettingDto {
    ward_id: number;
    fast_enabled?: number;
    fast_threshold?: number;
    slow_enabled?: number;
    slow_threshold?: number;
    complete_enabled?: number;
    complete_threshold?: number;
    stop_enabled?: number;
    default_gatt?: number;
    default_cchr?: number;
}
declare const UpdateWardSettingDto_base: import("@nestjs/common").Type<Partial<CreateWardSettingDto>>;
export declare class UpdateWardSettingDto extends UpdateWardSettingDto_base {
}
export {};
