import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Hospital } from './hospital.entity';
import { Room } from './room.entity';

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  hospital_id: number;

  @Column({ length: 200, nullable: true })
  name: string;

  @Column({ length: 20, nullable: true, comment: 'EMR 병동코드' })
  code: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  udpated_at: Date;

  @ManyToOne(() => Hospital, hospital => hospital.wards)
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @OneToMany(() => Room, room => room.ward)
  rooms: Room[];
}