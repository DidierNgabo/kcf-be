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

  // 4320 minutes = 3 days, the original default before minute-level
  // configuration was added.
  @Column({ type: 'int', default: 4320 })
  delayMinutes: number;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn() updatedAt: Date;
}
