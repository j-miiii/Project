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
exports.UserLockoutLog = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let UserLockoutLog = class UserLockoutLog {
};
exports.UserLockoutLog = UserLockoutLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserLockoutLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ comment: '잠금/해제 대상 사용자' }),
    __metadata("design:type", Number)
], UserLockoutLog.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['LOCKED', 'UNLOCKED'], comment: '이벤트 타입: 잠김 또는 풀림' }),
    __metadata("design:type", String)
], UserLockoutLog.prototype, "event_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', comment: '이벤트 발생 시각' }),
    __metadata("design:type", Date)
], UserLockoutLog.prototype, "changed_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, comment: '변경 주체 (예: SYSTEM, admin_id)' }),
    __metadata("design:type", String)
], UserLockoutLog.prototype, "changed_by", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ comment: '레코드 생성 시각' }),
    __metadata("design:type", Date)
], UserLockoutLog.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ comment: '레코드 수정 시각' }),
    __metadata("design:type", Date)
], UserLockoutLog.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserLockoutLog.prototype, "user", void 0);
exports.UserLockoutLog = UserLockoutLog = __decorate([
    (0, typeorm_1.Entity)('user_lockout_log')
], UserLockoutLog);
//# sourceMappingURL=user-lockout-log.entity.js.map