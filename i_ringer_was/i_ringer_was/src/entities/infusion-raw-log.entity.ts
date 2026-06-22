import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('infusion_raw_logs')
export class InfusionRawLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, comment: 'iRinger 디바이스 시리얼 번호' })
  sn: string;

  @Column({ type: 'varchar', length: 50, comment: 'API 구분자' })
  api: string;

  @Column({ type: 'enum', enum: ['IR', 'LOAD_CELL'], comment: '디바이스 타입 (IR 또는 LOAD_CELL)' })
  device_type: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, comment: '무게 측정값 (소수점 2자리)' })
  weight: number;

  @Column({ type: 'int', comment: '배터리 잔량' })
  battery: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, comment: '주입량 (ml)' })
  injected_amount: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, comment: '방울 수 (gtt)' })
  gtt: number;

  @Column({ type: 'int', nullable: true, comment: '측정 유속 (cc/hr)' })
  cchr: number;

  @Column({ type: 'int', nullable: true, comment: '남은 시간 (분)' })
  rest_minute: number;

  @Column({ type: 'bigint', nullable: true, comment: '타임스탬프' })
  time: number;

  @Column({ type: 'json', nullable: true, comment: '추가 JSON 데이터' })
  extra_json: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}