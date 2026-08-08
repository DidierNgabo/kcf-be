import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('email_layout')
export class EmailLayout {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ unique: true }) key: string;

  @Column() name: string;

  // Must contain the literal `{{{body}}}` slot the rendered template body is injected into.
  @Column({ type: 'text' }) bodyHtml: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
