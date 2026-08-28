import { ILike, Repository } from 'typeorm';
import { SponsorService } from './sponsor.service';
import { Sponsor } from './entities/sponsor.entity';
import { FollowUpService } from './follow-up.service';
import { ChildrenService } from '../children/children.service';
import { ConsentStatus, ConsentType } from '../children/enums/child.enums';
import { MailService } from '../mail/mail.service';
import type { StorageService } from '../storage/storage.types';

function makeChild(overrides: Record<string, unknown> = {}) {
  return {
    id: 'child-1',
    name: 'Divine',
    dateOfBirth: null,
    subject: null,
    dream: null,
    hobby: null,
    personality: null,
    family: null,
    location: null,
    uniqueQuality: null,
    profileMediaId: null,
    consents: [],
    media: [],
    get age() {
      return 9;
    },
    ...overrides,
  };
}

describe('SponsorService', () => {
  let sponsorRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let storage: { copyObject: jest.Mock; getPublicUrl: jest.Mock };
  let childrenService: { findEntityById: jest.Mock; saveEntity: jest.Mock };
  let mailService: { send: jest.Mock; findByRecipient: jest.Mock };
  let followUpService: { sendFollowUpNow: jest.Mock };
  let service: SponsorService;

  beforeEach(() => {
    sponsorRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((s: unknown) => Promise.resolve(s)),
      create: jest.fn((value: object) => value),
    };
    storage = {
      copyObject: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn(
        (objectKey: string) => `https://pub-example.r2.dev/${objectKey}`,
      ),
    };
    childrenService = {
      findEntityById: jest.fn(),
      saveEntity: jest.fn((c: unknown) => Promise.resolve(c)),
    };
    mailService = {
      send: jest.fn().mockResolvedValue(undefined),
      findByRecipient: jest.fn(),
    };
    followUpService = { sendFollowUpNow: jest.fn() };
    service = new SponsorService(
      sponsorRepo as unknown as Repository<Sponsor>,
      childrenService as unknown as ChildrenService,
      mailService as unknown as MailService,
      followUpService as unknown as FollowUpService,
      storage as unknown as StorageService,
    );
  });

  describe('submit', () => {
    const submission = {
      name: 'Aline',
      email: 'aline@example.org',
      phone: '+250700000000',
      message: 'Interested',
    };

    it('persists a new sponsor before sending the profile invitation', async () => {
      const saved = { id: 's1', ...submission, followUpSentAt: null };
      sponsorRepo.findOne.mockResolvedValue(null);
      sponsorRepo.save.mockResolvedValue(saved);

      await service.submit(submission);

      expect(sponsorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: submission.email }),
      );
      expect(followUpService.sendFollowUpNow).toHaveBeenCalledWith(saved);
      expect(mailService.send).not.toHaveBeenCalledWith(
        expect.objectContaining({ triggerKey: 'sponsor.acknowledged' }),
      );
    });

    it('does not resend an already-queued profile invitation', async () => {
      const existing = {
        id: 's1',
        ...submission,
        followUpSentAt: new Date(),
      };
      sponsorRepo.findOne.mockResolvedValue(existing);
      sponsorRepo.save.mockResolvedValue(existing);

      await service.submit(submission);

      expect(followUpService.sendFollowUpNow).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns the full unfiltered list (unchanged) when no search term is given', async () => {
      await service.findAll();
      expect(sponsorRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('returns the full unfiltered list when called with no query at all', async () => {
      await service.findAll(undefined);
      expect(sponsorRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('searches by name/email and applies the limit when a search term is given', async () => {
      await service.findAll({ search: 'aline', limit: 6 });
      expect(sponsorRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ name: ILike('%aline%') }, { email: ILike('%aline%') }],
          take: 6,
        }),
      );
    });
  });

  describe('match', () => {
    beforeEach(() => {
      sponsorRepo.findOne.mockResolvedValue(null);
    });

    it('copies the consented profile photo to a public key and passes its URL to the mail trigger', async () => {
      const child = makeChild({
        profileMediaId: 'media-1',
        media: [
          {
            id: 'media-1',
            objectKey: 'children/child-1/2026/photo.jpg',
            archivedAt: null,
          },
        ],
        consents: [
          {
            type: ConsentType.PHOTO,
            status: ConsentStatus.GRANTED,
            effectiveAt: new Date(),
          },
        ],
      });
      childrenService.findEntityById.mockResolvedValue(child);

      await service.match({
        childId: 'child-1',
        sponsorEmail: 's@example.org',
        sponsorName: 'Aline',
      });

      expect(storage.copyObject).toHaveBeenCalledWith(
        'children/child-1/2026/photo.jpg',
        'email-assets/sponsor-photos/child-1.jpg',
      );
      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            childPhotoUrl:
              'https://pub-example.r2.dev/email-assets/sponsor-photos/child-1.jpg',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('falls back to no photo (empty string) when photo consent was not granted', async () => {
      const child = makeChild({
        profileMediaId: 'media-1',
        media: [
          {
            id: 'media-1',
            objectKey: 'children/child-1/2026/photo.jpg',
            archivedAt: null,
          },
        ],
        consents: [
          {
            type: ConsentType.PHOTO,
            status: ConsentStatus.DENIED,
            effectiveAt: new Date(),
          },
        ],
      });
      childrenService.findEntityById.mockResolvedValue(child);

      await service.match({
        childId: 'child-1',
        sponsorEmail: 's@example.org',
        sponsorName: 'Aline',
      });

      expect(storage.copyObject).not.toHaveBeenCalled();
      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ childPhotoUrl: '' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('falls back to no photo when consent is granted but no profile photo is on file', async () => {
      const child = makeChild({
        profileMediaId: null,
        consents: [
          {
            type: ConsentType.PHOTO,
            status: ConsentStatus.GRANTED,
            effectiveAt: new Date(),
          },
        ],
      });
      childrenService.findEntityById.mockResolvedValue(child);

      await service.match({
        childId: 'child-1',
        sponsorEmail: 's@example.org',
        sponsorName: 'Aline',
      });

      expect(storage.copyObject).not.toHaveBeenCalled();
      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ childPhotoUrl: '' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('falls back to no photo (without throwing) when the storage copy fails', async () => {
      const child = makeChild({
        profileMediaId: 'media-1',
        media: [
          {
            id: 'media-1',
            objectKey: 'children/child-1/2026/photo.jpg',
            archivedAt: null,
          },
        ],
        consents: [
          {
            type: ConsentType.PHOTO,
            status: ConsentStatus.GRANTED,
            effectiveAt: new Date(),
          },
        ],
      });
      childrenService.findEntityById.mockResolvedValue(child);
      storage.copyObject.mockRejectedValue(new Error('R2 unreachable'));

      await expect(
        service.match({
          childId: 'child-1',
          sponsorEmail: 's@example.org',
          sponsorName: 'Aline',
        }),
      ).resolves.toBeUndefined();

      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ childPhotoUrl: '' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });
  });

  describe('listEmails', () => {
    it("looks up the sponsor's email history by their recipient email", async () => {
      sponsorRepo.findOne.mockResolvedValue({
        id: 's1',
        email: 's@example.org',
      });
      mailService.findByRecipient.mockResolvedValue([
        { id: 'log-1', triggerKey: 'sponsor.acknowledged' },
      ]);

      const result = await service.listEmails('s1');

      expect(mailService.findByRecipient).toHaveBeenCalledWith('s@example.org');
      expect(result).toEqual([
        { id: 'log-1', triggerKey: 'sponsor.acknowledged' },
      ]);
    });
  });

  describe('resendEmail', () => {
    it("resends the acknowledgment email with the sponsor's current name", async () => {
      sponsorRepo.findOne.mockResolvedValue({
        id: 's1',
        name: 'Aline',
        email: 's@example.org',
        child: null,
      });

      await service.resendEmail('s1', 'sponsor.acknowledged');

      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerKey: 'sponsor.acknowledged',
          to: 's@example.org',
          data: expect.objectContaining({ name: 'Aline' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('rebuilds and resends the matched email when the sponsor has a matched child', async () => {
      const child = makeChild();
      sponsorRepo.findOne.mockResolvedValue({
        id: 's1',
        name: 'Aline',
        email: 's@example.org',
        child: { id: 'child-1' },
      });
      childrenService.findEntityById.mockResolvedValue(child);

      await service.resendEmail('s1', 'sponsor.matched');

      expect(childrenService.findEntityById).toHaveBeenCalledWith('child-1');
      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerKey: 'sponsor.matched',
          to: 's@example.org',
          data: expect.objectContaining({ childName: 'Divine' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('refuses to resend the matched email when the sponsor has no matched child', async () => {
      sponsorRepo.findOne.mockResolvedValue({
        id: 's1',
        name: 'Aline',
        email: 's@example.org',
        child: null,
      });

      await expect(
        service.resendEmail('s1', 'sponsor.matched'),
      ).rejects.toThrow(/no matched child/);
      expect(mailService.send).not.toHaveBeenCalled();
    });

    it('delegates the profile-reminder resend to FollowUpService', async () => {
      const sponsor = {
        id: 's1',
        name: 'Aline',
        email: 's@example.org',
        child: null,
      };
      sponsorRepo.findOne.mockResolvedValue(sponsor);

      await service.resendEmail('s1', 'sponsor.profile-reminder');

      expect(followUpService.sendFollowUpNow).toHaveBeenCalledWith(sponsor);
    });

    it('rejects an unsupported trigger key', async () => {
      sponsorRepo.findOne.mockResolvedValue({
        id: 's1',
        name: 'Aline',
        email: 's@example.org',
        child: null,
      });

      await expect(
        service.resendEmail('s1', 'user.password-reset'),
      ).rejects.toThrow(/not supported/);
    });
  });

  describe('updatePreferences', () => {
    it('saves birthday and queues acknowledgment on first completion', async () => {
      sponsorRepo.findOne.mockResolvedValue({
        id: 's1',
        name: 'Aline',
        email: 'aline@example.org',
        childInterests: null,
        preferencesCompletedAt: null,
        acknowledgmentSentAt: null,
      });

      const result = await service.updatePreferences('s1', {
        childInterests: 'Sports and music',
        birthday: '1990-04-12',
      });

      expect(result.childInterests).toBe('Sports and music');
      expect(result.birthday).toBe('1990-04-12');
      expect(result.preferencesCompletedAt).toBeInstanceOf(Date);
      expect(result.acknowledgmentSentAt).toBeInstanceOf(Date);
      expect(mailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ triggerKey: 'sponsor.acknowledged' }),
      );
    });

    it('does not send another acknowledgment on later edits', async () => {
      const completedAt = new Date();
      sponsorRepo.findOne.mockResolvedValue({
        id: 's1',
        name: 'Aline',
        email: 'aline@example.org',
        preferencesCompletedAt: completedAt,
        acknowledgmentSentAt: new Date(),
      });

      await service.updatePreferences('s1', { childInterests: 'Music' });

      expect(mailService.send).not.toHaveBeenCalled();
    });

    it('leaves acknowledgment unstamped when queueing fails so a later edit retries it', async () => {
      const sponsor = {
        id: 's1',
        name: 'Aline',
        email: 'aline@example.org',
        preferencesCompletedAt: null,
        acknowledgmentSentAt: null,
      };
      sponsorRepo.findOne.mockResolvedValue(sponsor);
      mailService.send.mockRejectedValue(new Error('Redis unavailable'));

      await expect(
        service.updatePreferences('s1', { childInterests: 'Science' }),
      ).rejects.toThrow('Redis unavailable');

      expect(sponsor.preferencesCompletedAt).toBeInstanceOf(Date);
      expect(sponsor.acknowledgmentSentAt).toBeNull();
    });
  });
});
