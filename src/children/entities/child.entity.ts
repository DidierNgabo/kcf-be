import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Child {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  age: number;

  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column()
  imageUrl: string;

  @Column('text')
  bio: string;

  @Column()
  subject: string;

  @Column()
  dream: string;

  @Column()
  hobby: string;

  @Column()
  personality: string;

  @Column()
  family: string;

  @Column()
  location: string;

  @Column('text')
  uniqueQuality: string;

  @Column({ type: 'varchar', nullable: true })
  schoolName: string | null;

  @Column({ type: 'varchar', nullable: true })
  schoolLevel: string | null;

  @Column({ type: 'varchar', nullable: true })
  schoolYearGroup: string | null;

  @Column({ type: 'date', nullable: true })
  enrolmentDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  guardianName: string | null;

  @Column({ type: 'varchar', nullable: true })
  guardianRelationship: string | null;

  @Column({ type: 'boolean', default: false })
  guardianConsent: boolean;

  @Column({ type: 'boolean', default: false })
  photoConsentStatus: boolean;

  @Column({ type: 'date', nullable: true })
  sponsorshipStartDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
