import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { AccessToken } from './access-token.entity';
import { Notification } from './notification.entity';
import { UserSetting } from './user-setting.entity';
import { Hospital } from './hospital.entity';
import { Ward } from './ward.entity';
import { NurseRoomAssignment } from './nurse-room-assignment.entity';
import { UserTermAgreement } from './user-term-agreement.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ['super_admin', 'admin', 'nurse'], nullable: true })
  role: string;

  @Column({ length: 50, nullable: true })
  auth_id: string;

  @Column({ length: 255, nullable: true })
  password: string;

  @Column({ length: 100, nullable: false })
  nickname: string;

  @Column({ nullable: true })
  hospital_id: number;

  @Column({ nullable: true })
  ward_id: number;

  @Column({ type: 'boolean', default: false, comment: 'EMR 시스템 활성화 여부' })
  has_emr: boolean;

  @Column({ length: 50, nullable: true, comment: 'EMR 로그인 시 user 고유키' })
  emr_user_key: string;

  @Column({ length: 50, nullable: true, comment: 'EMR 권한코드' })
  emr_group_code: string;

  @Column({ length: 100, nullable: true, comment: 'EMR 권한설명' })
  emr_group_desc: string;

  @Column({ length: 20, nullable: true, comment: '근무 부서코드' })
  dept_code: string;

  @Column({ length: 50, nullable: true, unique: true, comment: '사번 (최초 설정 후 변경 불가)' })
  employee_number: string;

  @Column({ length: 500, default: '/images/default_profile.png', comment: '프로필 이미지' })
  profile_image: string;

  @Column({ length: 255, nullable: true, comment: 'Firebase Cloud Messaging 토큰' })
  fcm_token: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Hospital)
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @ManyToOne(() => Ward)
  @JoinColumn({ name: 'ward_id' })
  ward: Ward;

  @OneToMany(() => AccessToken, token => token.user)
  accessTokens: AccessToken[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications: Notification[];

  @OneToMany(() => UserSetting, setting => setting.user)
  userSettings: UserSetting[];

  @OneToMany(() => NurseRoomAssignment, assignment => assignment.user)
  nurseRoomAssignments: NurseRoomAssignment[];

  @OneToMany(() => UserTermAgreement, agreement => agreement.user)
  termAgreements: UserTermAgreement[];
}