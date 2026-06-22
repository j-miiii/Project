export declare enum AlarmType {
    NORMAL = "normal",
    FAST = "fast",
    SLOW = "slow",
    COMPLETE = "complete",
    ERROR = "error"
}
export declare class CreateInfusionLogDto {
    device_id: number;
    patient_bed_assignment_id: number;
    log_time: string;
    flow_rate: number;
    infused_volume: number;
    alarm_type: AlarmType;
}
declare const UpdateInfusionLogDto_base: import("@nestjs/common").Type<Partial<CreateInfusionLogDto>>;
export declare class UpdateInfusionLogDto extends UpdateInfusionLogDto_base {
}
export {};
