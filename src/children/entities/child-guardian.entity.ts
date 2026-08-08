import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Child } from './child.entity';

@Entity('child_guardian')
export class ChildGuardian {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Child, (child) => child.guardians, { onDelete: 'CASCADE' }) child: Child;
  @Column({ type: 'varchar', nullable: true }) name: string | null;
  @Column() relationship: string;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ type: 'varchar', nullable: true }) email: string | null;
  @Column({ default: true }) isPrimary: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
