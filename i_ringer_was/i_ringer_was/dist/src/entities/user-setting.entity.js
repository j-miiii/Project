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
exports.UserSetting = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let UserSetting = class UserSetting {
};
exports.UserSetting = UserSetting;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserSetting.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 0, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "fast_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 50, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "fast_threshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 0, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "slow_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: -50, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "slow_threshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 60, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "default_gatt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "default_cchr", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 1, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "complete_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 95, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "complete_threshold", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 1, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "stop_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, default: '#FF0000', nullable: true }),
    __metadata("design:type", String)
], UserSetting.prototype, "alert_color", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 5, nullable: true }),
    __metadata("design:type", Number)
], UserSetting.prototype, "alert_display_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 1 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "critical_alert_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 1 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "critical_sound_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 100 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "critical_sound_volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 1 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "caution_alert_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 1 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "caution_sound_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 100 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "caution_sound_volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 1 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "system_error_alert_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 1 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "system_error_sound_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 100 }),
    __metadata("design:type", Number)
], UserSetting.prototype, "system_error_sound_volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, default: 'percentage' }),
    __metadata("design:type", String)
], UserSetting.prototype, "volume_display_mode", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserSetting.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserSetting.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, user => user.userSettings),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserSetting.prototype, "user", void 0);
exports.UserSetting = UserSetting = __decorate([
    (0, typeorm_1.Entity)('user_settings')
], UserSetting);
//# sourceMappingURL=user-setting.entity.js.map