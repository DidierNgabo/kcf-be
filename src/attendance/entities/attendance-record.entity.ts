import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AttendanceStatus } from '../enums/attendance-status.enum';

@Entity('attendance_record')
@Index(['attendanceDayId', 'childId'], { unique: true })
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) attendanceDayId: string;

  @Column({ type: 'uuid' }) childId: string;

  @Column({ type: 'varchar', default: AttendanceStatus.PRESENT })
  status: AttendanceStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  markedByUserId: string | null;

  @CreateDateColumn() createdAt: Date;
}
