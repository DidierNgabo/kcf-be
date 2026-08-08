import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { Sponsor } from '../sponsor/entities/sponsor.entity';
import { MailService } from '../mail/mail.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    find: jest.Mock;
  };
  let sponsorRepo: { findOne: jest.Mock };
  let mailService: { send: jest.Mock };

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn(),
      create: jest.fn((data: Partial<User>): Partial<User> => data),
      save: jest.fn((data) => Promise.resolve({ id: 'new-id', ...data })),
      count: jest.fn(),
      find: jest.fn(),
    };
    sponsorRepo = { findOne: jest.fn() };
    mailService = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Sponsor), useValue: sponsorRepo },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get(UsersService);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  afterEach(() => jest.resetAllMocks());

  describe('create', () => {
    it('hashes the password, emails the invitation, and saves a new user', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.create({
        email: 'staff@kcf.org',
        password: 'password123',
        name: 'Staff Member',
        role: UserRole.STAFF,
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed-password' }),
      );
      expect(result.user).not.toHaveProperty('password');
      expect(result.temporaryPassword).toBe('password123');
      expect(result.emailSent).toBe(true);
    });

    it('auto-generates a temporary password when none is provided', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.create({
        email: 'staff2@kcf.org',
        name: 'Staff Member Two',
        role: UserRole.STAFF,
      });

      expect(typeof result.temporaryPassword).toBe('string');
      expect(result.temporaryPassword.length).toBeGreaterThan(0);
      expect(bcrypt.hash).toHaveBeenCalledWith(result.temporaryPassword, 10);
    });

    it('rejects a duplicate email', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({
          email: 'staff@kcf.org',
          password: 'password123',
          name: 'Staff Member',
          role: UserRole.STAFF,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createSponsorAccount', () => {
    const sponsor = {
      id: 'sponsor-1',
      email: 'sponsor@example.com',
      name: 'Jane',
    };

    it('throws when the sponsor does not exist', async () => {
      sponsorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createSponsorAccount({ sponsorId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when the sponsor already has a linked account', async () => {
      sponsorRepo.findOne.mockResolvedValue(sponsor);
      usersRepo.findOne.mockResolvedValueOnce({ id: 'already-linked' });

      await expect(
        service.createSponsorAccount({ sponsorId: sponsor.id }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the account and reports emailSent:false when the email send fails', async () => {
      sponsorRepo.findOne.mockResolvedValue(sponsor);
      usersRepo.findOne.mockResolvedValueOnce(null); // no existing link
      usersRepo.findOne.mockResolvedValueOnce(null); // no existing email
      jest
        .spyOn(service as any, 'sendAccountProvisionedEmail')
        .mockRejectedValue(new Error('mailtrap down'));

      const result = await service.createSponsorAccount({
        sponsorId: sponsor.id,
      });

      expect(result.emailSent).toBe(false);
      expect(result.user.role).toBe(UserRole.SPONSOR);
      expect(result.user.sponsorId).toBe(sponsor.id);
    });
  });

  describe('requestPasswordReset', () => {
    it('no-ops for an unknown email', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await service.requestPasswordReset('nobody@kcf.org');

      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('no-ops for an inactive user', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'x@kcf.org',
        isActive: false,
      });

      await service.requestPasswordReset('x@kcf.org');

      expect(usersRepo.save).not.toHaveBeenCalled();
    });

    it('sets a hashed reset token and expiry for an active user', async () => {
      const user = { id: 'u1', email: 'x@kcf.org', name: 'X', isActive: true };
      usersRepo.findOne.mockResolvedValue(user);

      await service.requestPasswordReset('x@kcf.org');

      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordResetTokenHash: expect.any(String) as string,
          passwordResetExpiresAt: expect.any(Date) as Date,
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('throws for an unknown token', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'newpassword123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws for an expired token', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword('expired-token', 'newpassword123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('hashes the new password and clears the reset token for a valid token', async () => {
      const user = {
        id: 'u1',
        passwordResetExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
      };
      usersRepo.findOne.mockResolvedValue(user);

      await service.resetPassword('good-token', 'newpassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashed-password',
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          passwordChangedAt: expect.any(Date) as Date,
        }),
      );
    });
  });
});
