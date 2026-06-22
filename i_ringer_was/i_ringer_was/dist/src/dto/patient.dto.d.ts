export declare class CreatePatientDto {
    name: string;
    chart_number: string;
}
declare const UpdatePatientDto_base: import("@nestjs/common").Type<Partial<CreatePatientDto>>;
export declare class UpdatePatientDto extends UpdatePatientDto_base {
}
export {};
