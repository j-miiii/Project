export declare enum InfusionEventType {
    START = "start",
    PAUSE = "pause",
    RESUME = "resume",
    COMPLETE = "complete",
    CANCEL = "cancel",
    ALERT = "alert",
    MODIFY = "modify"
}
export declare class CreateInfusionEventLogDto {
    patient_bed_assignment_id: number;
    event_type: InfusionEventType;
    before_value?: any;
    after_value?: any;
    performed_by?: number;
}
declare const UpdateInfusionEventLogDto_base: import("@nestjs/common").Type<Partial<CreateInfusionEventLogDto>>;
export declare class UpdateInfusionEventLogDto extends UpdateInfusionEventLogDto_base {
}
export {};
