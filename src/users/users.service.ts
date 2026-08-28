import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateSponsorAccountDto } from './dto/create-sponsor-account.dto';
import { Sponsor } from '../sponsor/entities/sponsor.entity';
import { MailService } from '../mail/mail.service';

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export type SafeUser = Omit<User, 'password' | 'passwordResetTokenHash'>;

export interface CreatedAccount {
  user: SafeUser;
  temporaryPassword: string;
  emailSent: boolean;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!email || !password) return;

    const adminCount = await this.usersRepo.count({
      where: { role: UserRole.ADMIN },
    });
    if (adminCount > 0) return;

    await this.create({
      email,
      password,
      name: process.env.ADMIN_BOOTSTRAP_NAME || 'Admin',
      role: UserRole.ADMIN,
    });
    this.logger.log(`Bootstrapped initial admin account: ${email}`);
  }

  async create(dto: CreateUserDto): Promise<CreatedAccount> {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `User with email "${dto.email}" already exists`,
      );
    }

    const temporaryPassword = dto.password ?? this.generateTemporaryPassword();

    const user = this.usersRepo.create({
      email: dto.email,
      name: dto.name,
      role: dto.role,
      password: await bcrypt.hash(temporaryPassword, SALT_ROUNDS),
      passwordChangedAt: new Date(),
    });
    const saved = await this.usersRepo.save(user);

    let emailSent = false;
    try {
      await this.sendStaffInvitationEmail(
        dto.email,
        dto.name,
        temporaryPassword,
      );
      emailSent = true;
    } catch (err) {
      this.logger.error(`Failed to send invitation email to ${dto.email}`, err);
    }

    return { user: this.toSafeUser(saved), temporaryPassword, emailSent };
  }

  async createSponsorAccount(
    dto: CreateSponsorAccountDto,
  ): Promise<CreatedAccount> {
    const sponsor = await this.sponsorRepo.findOne({
      where: { id: dto.sponsorId },
    });
    if (!sponsor) {
      throw new NotFoundException(
        `Sponsor with id "${dto.sponsorId}" not found`,
      );
    }

    const existingLink = await this.usersRepo.findOne({
      where: { sponsorId: sponsor.id },
    });
    if (existingLink) {
      throw new ConflictException('This sponsor already has a login account');
    }

    const existingEmail = await this.usersRepo.findOne({
      where: { email: sponsor.email },
    });
    if (existingEmail) {
      throw new ConflictException(
        `User with email "${sponsor.email}" already exists`,
      );
    }

    const temporaryPassword = dto.password ?? this.generateTemporaryPassword();

    const user = this.usersRepo.create({
      email: sponsor.email,
      name: sponsor.name,
      role: UserRole.SPONSOR,
      sponsorId: sponsor.id,
      password: await bcrypt.hash(temporaryPassword, SALT_ROUNDS),
      passwordChangedAt: new Date(),
    });
    const saved = await this.usersRepo.save(user);

    let emailSent = false;
    if (!dto.skipEmail) {
      try {
        await this.sendAccountProvisionedEmail(
          sponsor.email,
          sponsor.name,
          temporaryPassword,
        );
        emailSent = true;
      } catch (err) {
        this.logger.error(
          `Failed to send account-provisioned email to ${sponsor.email}`,
          err,
        );
      }
    }

    return { user: this.toSafeUser(saved), temporaryPassword, emailSent };
  }

  async rotateUnsentSponsorInvitationPassword(
    sponsorId: string,
  ): Promise<string> {
    const user = await this.usersRepo.findOne({ where: { sponsorId } });
    if (!user) {
      throw new NotFoundException(
        `No login account exists for sponsor "${sponsorId}"`,
      );
    }
    const temporaryPassword = this.generateTemporaryPassword();
    user.password = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
    user.passwordChangedAt = new Date();
    await this.usersRepo.save(user);
    return temporaryPassword;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user || !user.isActive) return;

    const token = crypto.randomBytes(32).toString('base64url');
    user.passwordResetTokenHash = this.hashToken(token);
    user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.usersRepo.save(user);

    try {
      await this.sendPasswordResetEmail(user.email, user.name, token);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const user = await this.usersRepo.findOne({
      where: { passwordResetTokenHash: tokenHash },
    });

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'This password reset link is invalid or has expired.',
      );
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.passwordChangedAt = new Date();
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.usersRepo.save(user);
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'password',
        'name',
        'role',
        'isActive',
        'sponsorId',
      ],
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
    return users.map((u) => this.toSafeUser(u));
  }

  private generateTemporaryPassword(): string {
    return crypto.randomBytes(9).toString('base64url');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toSafeUser(user: User): SafeUser {
    const safe: Partial<User> = { ...user };
    delete safe.password;
    delete safe.passwordResetTokenHash;
    return safe as SafeUser;
  }

  private async sendAccountProvisionedEmail(
    email: string,
    name: string,
    temporaryPassword: string,
  ): Promise<void> {
    const frontendUrl = process.env.MIS_FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/login`;
    await this.mailService.send({
      triggerKey: 'user.account-provisioned',
      to: email,
      data: { name, email, temporaryPassword, loginUrl },
    });
  }

  private async sendStaffInvitationEmail(
    email: string,
    name: string,
    temporaryPassword: string,
  ): Promise<void> {
    await this.mailService.send({
      triggerKey: 'user.staff-invitation',
      to: email,
      data: { name, email, temporaryPassword },
    });
  }

  private async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = process.env.MIS_FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mailService.send({
      triggerKey: 'user.password-reset',
      to: email,
      data: { name, resetUrl },
    });
  }
}
