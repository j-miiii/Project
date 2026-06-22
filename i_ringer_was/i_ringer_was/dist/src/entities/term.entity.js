"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Term = void 0;
const typeorm_1 = require("typeorm");
const user_term_agreement_entity_1 = require("./user-term-agreement.entity");
let Term = class Term {
};
exports.Term = Term;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Term.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200, nullable: false, comment: '약관 제목' }),
    __metadata("design:type", String)
], Term.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: false, comment: '약관 내용' }),
    __metadata("design:type", String)
], Term.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, nullable: false, comment: '약관 버전' }),
    __metadata("design:type", String)
], Term.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['privacy', 'service', 'marketing', 'location'], nullable: false, comment: '약관 유형' }),
    __metadata("design:type", String)
], Term.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true, comment: '필수 동의 여부' }),
    __metadata("design:type", Boolean)
], Term.prototype, "is_required", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true, comment: '활성 여부' }),
    __metadata("design:type", Boolean)
], Term.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true, comment: '시행일' }),
    __metadata("design:type", Date)
], Term.prototype, "effective_at", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Term.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Term.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => user_term_agreement_entity_1.UserTermAgreement, agreement => agreement.term),
    __metadata("design:type", Array)
], Term.prototype, "agreements", void 0);
exports.Term = Term = __decorate([
    (0, typeorm_1.Entity)('terms')
], Term);
//# sourceMappingURL=term.entity.js.map