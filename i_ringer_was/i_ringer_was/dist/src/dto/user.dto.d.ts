export declare class CreateUserDto {
    role: string;
    auth_id: string;
    password: string;
    nickname: string;
    hospital_id?: string;
    ward_id?: number;
    employee_number?: string;
    profile_image?: string;
}
declare const UpdateUserDto_base: import("@nestjs/common").Type<Partial<CreateUserDto>>;
export declare class UpdateUserDto extends UpdateUserDto_base {
}
export {};
