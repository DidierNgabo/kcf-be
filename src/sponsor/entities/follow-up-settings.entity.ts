import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Effectively a singleton — one row seeded by migration, read/updated in
// place. Not a generic key-value settings table: nothing else needs
// admin-configurable timing yet, so this stays purpose-built.
@Entity('follow_up_settings')
export class FollowUpSettings {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'int', default: 3 })
  delayDays: number;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn() updatedAt: Date;
}
