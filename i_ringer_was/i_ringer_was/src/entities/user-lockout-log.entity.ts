import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_lockout_log')
export class UserLockoutLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '잠금/해제 대상 사용자' })
  user_id: number;

  @Column({ type: 'enum', enum: ['LOCKED', 'UNLOCKED'], comment: '이벤트 타입: 잠김 또는 풀림' })
  event_type: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', comment: '이벤트 발생 시각' })
  changed_at: Date;

  @Column({ length: 50, comment: '변경 주체 (예: SYSTEM, admin_id)' })
  changed_by: string;

  @CreateDateColumn({ comment: '레코드 생성 시각' })
  created_at: Date;

  @UpdateDateColumn({ comment: '레코드 수정 시각' })
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
