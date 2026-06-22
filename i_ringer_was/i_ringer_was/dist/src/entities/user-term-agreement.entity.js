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
exports.UserTermAgreement = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
const term_entity_1 = require("./term.entity");
let UserTermAgreement = class UserTermAgreement {
};
exports.UserTermAgreement = UserTermAgreement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserTermAgreement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: false }),
    __metadata("design:type", Number)
], UserTermAgreement.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: false }),
    __metadata("design:type", Number)
], UserTermAgreement.prototype, "term_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', comment: '동의 시간' }),
    __metadata("design:type", Date)
], UserTermAgreement.prototype, "agreed_at", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserTermAgreement.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserTermAgreement.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, user => user.termAgreements, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserTermAgreement.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => term_entity_1.Term, term => term.agreements, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'term_id' }),
    __metadata("design:type", term_entity_1.Term)
], UserTermAgreement.prototype, "term", void 0);
exports.UserTermAgreement = UserTermAgreement = __decorate([
    (0, typeorm_1.Entity)('user_term_agreements')
], UserTermAgreement);
//# sourceMappingURL=user-term-agreement.entity.js.map