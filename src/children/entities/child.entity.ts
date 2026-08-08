import {
  Column, CreateDateColumn, Entity, Index, OneToMany,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { ChildStatus } from '../enums/child.enums';
import { ChildConsent } from './child-consent.entity';
import { ChildEducation } from './child-education.entity';
import { ChildGuardian } from './child-guardian.entity';
import { ChildMedia } from './child-media.entity';

@Entity('child')
export class Child {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  kcfNumber: string | null;

  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) gender: string | null;
  @Column({ type: 'date', nullable: true }) dateOfBirth: Date | null;
  @Column({ type: 'date', nullable: true }) enrolmentDate: Date | null;
  @Column({ type: 'varchar', default: ChildStatus.ACTIVE }) status: ChildStatus;
  @Column({ type: 'timestamptz', nullable: true }) archivedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) profileMediaId: string | null;

  // Public-profile fields retained while kcf-web migrates to the richer profile.
  @Column({ type: 'varchar', nullable: true }) imageUrl: string | null;
  @Column({ type: 'text', nullable: true }) bio: string | null;
  @Column({ type: 'varchar', nullable: true }) subject: string | null;
  @Column({ type: 'varchar', nullable: true }) dream: string | null;
  @Column({ type: 'varchar', nullable: true }) hobby: string | null;
  @Column({ type: 'varchar', nullable: true }) personality: string | null;
  @Column({ type: 'varchar', nullable: true }) family: string | null;
  @Column({ type: 'varchar', nullable: true }) location: string | null;
  @Column({ type: 'text', nullable: true }) uniqueQuality: string | null;

  @OneToMany(() => ChildEducation, (record) => record.child, { cascade: true })
  educationRecords: ChildEducation[];
  @OneToMany(() => ChildGuardian, (guardian) => guardian.child, { cascade: true })
  guardians: ChildGuardian[];
  @OneToMany(() => ChildConsent, (consent) => consent.child, { cascade: true })
  consents: ChildConsent[];
  @OneToMany(() => ChildMedia, (media) => media.child)
  media: ChildMedia[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  get age(): number | null {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birth = new Date(this.dateOfBirth);
    let value = today.getUTCFullYear() - birth.getUTCFullYear();
    if (
      today.getUTCMonth() < birth.getUTCMonth() ||
      (today.getUTCMonth() === birth.getUTCMonth() &&
        today.getUTCDate() < birth.getUTCDate())
    ) value -= 1;
    return value;
  }
}
