export declare class CreateUserTermAgreementDto {
    user_id: number;
    term_id: number;
    agreed_at?: string;
}
declare const UpdateUserTermAgreementDto_base: import("@nestjs/common").Type<Partial<CreateUserTermAgreementDto>>;
export declare class UpdateUserTermAgreementDto extends UpdateUserTermAgreementDto_base {
}
export {};
