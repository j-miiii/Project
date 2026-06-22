import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_lockout_status')
export class UserLockoutStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, comment: '사용자 ID (unique)' })
  user_id: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0, comment: '연속 실패 횟수 (0-255)' })
  failure_count: number;

  @Column({ type: 'boolean', default: false, comment: '현재 잠금 상태' })
  is_locked: boolean;

  @CreateDateColumn({ comment: '레코드 생성 시각' })
  created_at: Date;

  @UpdateDateColumn({ comment: '레코드 수정 시각' })
  updated_at: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
