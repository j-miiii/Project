export declare class CreateInfusionDto {
    code?: string;
    name: string;
    default_volume?: number;
    default_gtt?: number;
    default_cchr?: number;
    description?: string;
    is_active?: boolean;
    display_order?: number;
    usage_count?: number;
}
declare const UpdateInfusionDto_base: import("@nestjs/common").Type<Partial<CreateInfusionDto>>;
export declare class UpdateInfusionDto extends UpdateInfusionDto_base {
}
export {};
