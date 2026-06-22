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
exports.UserLockoutStatus = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let UserLockoutStatus = class UserLockoutStatus {
};
exports.UserLockoutStatus = UserLockoutStatus;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserLockoutStatus.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true, comment: '사용자 ID (unique)' }),
    __metadata("design:type", Number)
], UserLockoutStatus.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', unsigned: true, default: 0, comment: '연속 실패 횟수 (0-255)' }),
    __metadata("design:type", Number)
], UserLockoutStatus.prototype, "failure_count", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false, comment: '현재 잠금 상태' }),
    __metadata("design:type", Boolean)
], UserLockoutStatus.prototype, "is_locked", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '레코드 생성 시각' }),
    __metadata("design:type", Date)
], UserLockoutStatus.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ comment: '레코드 수정 시각' }),
    __metadata("design:type", Date)
], UserLockoutStatus.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserLockoutStatus.prototype, "user", void 0);
exports.UserLockoutStatus = UserLockoutStatus = __decorate([
    (0, typeorm_1.Entity)('user_lockout_status')
], UserLockoutStatus);
//# sourceMappingURL=user-lockout-status.entity.js.map