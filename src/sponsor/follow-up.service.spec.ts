import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FollowUpService } from './follow-up.service';
import { Sponsor } from './entities/sponsor.entity';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

describe('FollowUpService', () => {
  let sponsorRepo: { save: jest.Mock };
  let mailService: { send: jest.Mock };
  let usersService: {
    createSponsorAccount: jest.Mock;
    rotateUnsentSponsorInvitationPassword: jest.Mock;
  };
  let service: FollowUpService;

  beforeEach(() => {
    sponsorRepo = { save: jest.fn((value) => Promise.resolve(value)) };
    mailService = { send: jest.fn().mockResolvedValue(undefined) };
    usersService = {
      createSponsorAccount: jest.fn(),
      rotateUnsentSponsorInvitationPassword: jest.fn(),
    };
    service = new FollowUpService(
      sponsorRepo as unknown as Repository<Sponsor>,
      mailService as unknown as MailService,
      usersService as unknown as UsersService,
    );
  });

  it('provisions and immediately queues a profile invitation', async () => {
    const sponsor = {
      id: 'sp1',
      email: 'sponsor@example.org',
      name: 'Aline',
      followUpSentAt: null,
    } as Sponsor;
    usersService.createSponsorAccount.mockResolvedValue({
      temporaryPassword: 'random-password',
    });

    await service.sendFollowUpNow(sponsor);

    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerKey: 'sponsor.profile-reminder',
        data: expect.objectContaining({
          temporaryPassword: 'random-password',
          loginUrl: 'http://localhost:3000/login?next=/portal/preferences',
        }) as Record<string, unknown>,
      }),
    );
    expect(sponsor.followUpSentAt).toBeInstanceOf(Date);
  });

  it('rotates credentials when retrying an invitation that was never queued', async () => {
    const sponsor = {
      id: 'sp1',
      email: 'sponsor@example.org',
      name: 'Aline',
      followUpSentAt: null,
    } as Sponsor;
    usersService.createSponsorAccount.mockRejectedValue(
      new ConflictException('account exists'),
    );
    usersService.rotateUnsentSponsorInvitationPassword.mockResolvedValue(
      'fresh-password',
    );

    await service.sendFollowUpNow(sponsor);

    expect(
      usersService.rotateUnsentSponsorInvitationPassword,
    ).toHaveBeenCalledWith('sp1');
    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          temporaryPassword: 'fresh-password',
        }) as Record<string, unknown>,
      }),
    );
  });

  it('does not reset credentials for a manual resend after the first invitation', async () => {
    const sponsor = {
      id: 'sp1',
      email: 'sponsor@example.org',
      name: 'Aline',
      followUpSentAt: new Date(),
    } as Sponsor;
    usersService.createSponsorAccount.mockRejectedValue(
      new ConflictException('account exists'),
    );

    await service.sendFollowUpNow(sponsor);

    expect(
      usersService.rotateUnsentSponsorInvitationPassword,
    ).not.toHaveBeenCalled();
    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ temporaryPassword: '' }) as Record<
          string,
          unknown
        >,
      }),
    );
  });
});
