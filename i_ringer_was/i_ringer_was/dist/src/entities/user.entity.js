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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const access_token_entity_1 = require("./access-token.entity");
const notification_entity_1 = require("./notification.entity");
const user_setting_entity_1 = require("./user-setting.entity");
const hospital_entity_1 = require("./hospital.entity");
const ward_entity_1 = require("./ward.entity");
const nurse_room_assignment_entity_1 = require("./nurse-room-assignment.entity");
const user_term_agreement_entity_1 = require("./user-term-agreement.entity");
let User = class User {
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['super_admin', 'admin', 'nurse'], nullable: true }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "auth_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: false }),
    __metadata("design:type", String)
], User.prototype, "nickname", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], User.prototype, "hospital_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], User.prototype, "ward_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false, comment: 'EMR 시스템 활성화 여부' }),
    __metadata("design:type", Boolean)
], User.prototype, "has_emr", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: 'EMR 로그인 시 user 고유키' }),
    __metadata("design:type", String)
], User.prototype, "emr_user_key", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, comment: 'EMR 권한코드' }),
    __metadata("design:type", String)
], User.prototype, "emr_group_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true, comment: 'EMR 권한설명' }),
    __metadata("design:type", String)
], User.prototype, "emr_group_desc", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, nullable: true, comment: '근무 부서코드' }),
    __metadata("design:type", String)
], User.prototype, "dept_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true, unique: true, comment: '사번 (최초 설정 후 변경 불가)' }),
    __metadata("design:type", String)
], User.prototype, "employee_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 500, default: '/images/default_profile.png', comment: '프로필 이미지' }),
    __metadata("design:type", String)
], User.prototype, "profile_image", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255, nullable: true, comment: 'Firebase Cloud Messaging 토큰' }),
    __metadata("design:type", String)
], User.prototype, "fcm_token", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], User.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], User.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => hospital_entity_1.Hospital),
    (0, typeorm_1.JoinColumn)({ name: 'hospital_id' }),
    __metadata("design:type", hospital_entity_1.Hospital)
], User.prototype, "hospital", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ward_entity_1.Ward),
    (0, typeorm_1.JoinColumn)({ name: 'ward_id' }),
    __metadata("design:type", ward_entity_1.Ward)
], User.prototype, "ward", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => access_token_entity_1.AccessToken, token => token.user),
    __metadata("design:type", Array)
], User.prototype, "accessTokens", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => notification_entity_1.Notification, notification => notification.user),
    __metadata("design:type", Array)
], User.prototype, "notifications", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => user_setting_entity_1.UserSetting, setting => setting.user),
    __metadata("design:type", Array)
], User.prototype, "userSettings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => nurse_room_assignment_entity_1.NurseRoomAssignment, assignment => assignment.user),
    __metadata("design:type", Array)
], User.prototype, "nurseRoomAssignments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => user_term_agreement_entity_1.UserTermAgreement, agreement => agreement.user),
    __metadata("design:type", Array)
], User.prototype, "termAgreements", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users')
], User);
//# sourceMappingURL=user.entity.js.map