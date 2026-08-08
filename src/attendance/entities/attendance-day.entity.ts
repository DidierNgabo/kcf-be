import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Only created lazily, the first time a child is marked present for a date —
// a gathering day with zero attendance never needs a row.
@Entity('attendance_day')
export class AttendanceDay {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index({ unique: true })
  @Column({ type: 'date' })
  date: Date;

  // Blank for a regular Saturday gathering; filled in to flag a special one
  // (e.g. "Christmas Program") — free text rather than a fixed taxonomy.
  @Column({ type: 'text', nullable: true })
  label: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
