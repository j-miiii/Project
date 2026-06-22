import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_settings')
export class UserSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  user_id: number;

  @Column({ type: 'tinyint', default: 0, nullable: true })
  fast_enabled: number;

  @Column({ default: 50, nullable: true })
  fast_threshold: number;

  @Column({ type: 'tinyint', default: 0, nullable: true })
  slow_enabled: number;

  @Column({ default: -50, nullable: true })
  slow_threshold: number;

  @Column({ default: 60, nullable: true })
  default_gatt: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  default_cchr: number;

  @Column({ type: 'tinyint', default: 1, nullable: true })
  complete_enabled: number;

  @Column({ default: 95, nullable: true })
  complete_threshold: number;

  @Column({ type: 'tinyint', default: 1, nullable: true })
  stop_enabled: number;

  @Column({ length: 20, default: '#FF0000', nullable: true })
  alert_color: string;

  @Column({ default: 5, nullable: true })
  alert_display_time: number;

  @Column({ type: 'tinyint', default: 1 })
  critical_alert_enabled: number;

  @Column({ type: 'tinyint', default: 1 })
  critical_sound_enabled: number;

  @Column({ type: 'int', default: 100 })
  critical_sound_volume: number;

  @Column({ type: 'tinyint', default: 1 })
  caution_alert_enabled: number;

  @Column({ type: 'tinyint', default: 1 })
  caution_sound_enabled: number;

  @Column({ type: 'int', default: 100 })
  caution_sound_volume: number;

  @Column({ type: 'tinyint', default: 1 })
  system_error_alert_enabled: number;

  @Column({ type: 'tinyint', default: 1 })
  system_error_sound_enabled: number;

  @Column({ type: 'int', default: 100 })
  system_error_sound_volume: number;

  @Column({ length: 20, default: 'percentage' })
  volume_display_mode: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, user => user.userSettings)
  @JoinColumn({ name: 'user_id' })
  user: User;
}