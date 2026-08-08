import { ConflictException } from '@nestjs/common';
import { LessThanOrEqual, Repository } from 'typeorm';
import { FollowUpService } from './follow-up.service';
import { Sponsor } from './entities/sponsor.entity';
import { FollowUpSettings } from './entities/follow-up-settings.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

describe('FollowUpService', () => {
  let sponsorRepo: { find: jest.Mock; save: jest.Mock };
  let settingsRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let mailService: { send: jest.Mock };
  let usersService: { createSponsorAccount: jest.Mock };
  let service: FollowUpService;

  const sponsor = {
    id: 'sp1',
    email: 'sponsor@example.org',
    name: 'Aline',
  } as Sponsor;

  beforeEach(() => {
    sponsorRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((s: unknown) => Promise.resolve(s)),
    };
    settingsRepo = {
      find: jest.fn().mockResolvedValue([{ id: 'set1', delayDays: 5 }]),
      save: jest.fn((s: unknown) => Promise.resolve(s)),
      create: jest.fn((s: unknown) => s),
    };
    mailService = { send: jest.fn().mockResolvedValue(undefined) };
    usersService = { createSponsorAccount: jest.fn() };

    service = new FollowUpService(
      sponsorRepo as unknown as Repository<Sponsor>,
      settingsRepo as unknown as Repository<FollowUpSettings>,
      mailService as unknown as MailService,
      usersService as unknown as UsersService,
    );
  });

  describe('getSettings', () => {
    it('returns the existing singleton row', async () => {
      const settings = await service.getSettings();
      expect(settings).toEqual({ id: 'set1', delayDays: 5 });
      expect(settingsRepo.save).not.toHaveBeenCalled();
    });

    it('creates a default row when none exists yet', async () => {
      settingsRepo.find.mockResolvedValue([]);
      await service.getSettings();
      expect(settingsRepo.create).toHaveBeenCalledWith({});
      expect(settingsRepo.save).toHaveBeenCalled();
    });
  });

  describe('processQueue', () => {
    it('does nothing when no sponsors are due', async () => {
      await service.processQueue();
      expect(mailService.send).not.toHaveBeenCalled();
    });

    it('uses the configured delayDays (not a hardcoded value) to compute the cutoff', async () => {
      const fixedNow = new Date('2026-01-15T12:00:00.000Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      await service.processQueue();

      const expectedCutoff = new Date(fixedNow - 5 * 24 * 60 * 60 * 1000);
      expect(sponsorRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: LessThanOrEqual(expectedCutoff),
          }) as Record<string, unknown>,
        }),
      );

      jest.spyOn(Date, 'now').mockRestore();
    });

    it('provisions a fresh account and includes the temporary password when the sponsor has none yet', async () => {
      sponsorRepo.find.mockResolvedValue([sponsor]);
      usersService.createSponsorAccount.mockResolvedValue({
        temporaryPassword: 'Xk9-temp',
      });

      await service.processQueue();

      expect(usersService.createSponsorAccount).toHaveBeenCalledWith({
        sponsorId: sponsor.id,
        skipEmail: true,
      });
      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerKey: 'sponsor.profile-reminder',
          to: sponsor.email,
          data: expect.objectContaining({
            email: sponsor.email,
            temporaryPassword: 'Xk9-temp',
            loginUrl: expect.stringContaining(
              '/login?next=/portal/preferences',
            ) as string,
          }) as Record<string, unknown>,
        }),
      );
      expect(sponsorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ followUpSentAt: expect.any(Date) as Date }),
      );
    });

    it('sends an empty (not fake-example) temporaryPassword when the sponsor already has an account', async () => {
      sponsorRepo.find.mockResolvedValue([sponsor]);
      usersService.createSponsorAccount.mockRejectedValue(
        new ConflictException('This sponsor already has a login account'),
      );

      await service.processQueue();

      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ temporaryPassword: '' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('does not send or save when an unexpected error occurs provisioning the account', async () => {
      sponsorRepo.find.mockResolvedValue([sponsor]);
      usersService.createSponsorAccount.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await service.processQueue();

      expect(mailService.send).not.toHaveBeenCalled();
      expect(sponsorRepo.save).not.toHaveBeenCalled();
    });
  });
});
