export declare enum TermType {
    PRIVACY = "privacy",
    SERVICE = "service",
    MARKETING = "marketing",
    LOCATION = "location"
}
export declare class CreateTermDto {
    title: string;
    content: string;
    version: string;
    type: TermType;
    is_required?: boolean;
    is_active?: boolean;
    effective_at?: string;
}
declare const UpdateTermDto_base: import("@nestjs/common").Type<Partial<CreateTermDto>>;
export declare class UpdateTermDto extends UpdateTermDto_base {
}
export {};
