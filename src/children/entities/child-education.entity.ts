import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Child } from './child.entity';

@Entity('child_education')
@Index(['child', 'isCurrent'], { unique: true, where: '"isCurrent" = true' })
export class ChildEducation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Child, (child) => child.educationRecords, { onDelete: 'CASCADE' }) child: Child;
  @Column({ type: 'varchar', nullable: true }) schoolName: string | null;
  @Column({ type: 'varchar', nullable: true }) schoolLevel: string | null;
  @Column({ type: 'varchar', nullable: true }) yearGroup: string | null;
  @Column({ type: 'date', nullable: true }) startedAt: Date | null;
  @Column({ type: 'date', nullable: true }) endedAt: Date | null;
  @Column({ default: true }) isCurrent: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
