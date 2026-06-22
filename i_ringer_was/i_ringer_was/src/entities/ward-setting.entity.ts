import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Ward } from './ward.entity';

@Entity('ward_settings')
export class WardSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  ward_id: number;

  @Column({ type: 'tinyint', default: 1 })
  fast_enabled: number;

  @Column({ default: 50 })
  fast_threshold: number;

  @Column({ type: 'tinyint', default: 1 })
  slow_enabled: number;

  @Column({ default: 50 })
  slow_threshold: number;

  @Column({ type: 'tinyint', default: 1 })
  complete_enabled: number;

  @Column({ default: 95 })
  complete_threshold: number;

  @Column({ type: 'tinyint', default: 1 })
  stop_enabled: number;

  @Column({ default: 60 })
  default_gatt: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 164.10 })
  default_cchr: number;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at: Date;

  @ManyToOne(() => Ward)
  @JoinColumn({ name: 'ward_id' })
  ward: Ward;
}
