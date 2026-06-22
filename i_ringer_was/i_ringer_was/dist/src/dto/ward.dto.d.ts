export declare class CreateWardDto {
    hospital_id: number;
    name: string;
}
declare const UpdateWardDto_base: import("@nestjs/common").Type<Partial<CreateWardDto>>;
export declare class UpdateWardDto extends UpdateWardDto_base {
}
export {};
