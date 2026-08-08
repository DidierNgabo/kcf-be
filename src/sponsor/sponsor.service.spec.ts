import { ILike, Repository } from 'typeorm';
import { SponsorService } from './sponsor.service';
import { Sponsor } from './entities/sponsor.entity';
import { MailtrapContactsService } from './mailtrap-contacts.service';
import { ChildrenService } from '../children/children.service';
import { MailService } from '../mail/mail.service';

describe('SponsorService', () => {
  let sponsorRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let service: SponsorService;

  beforeEach(() => {
    sponsorRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((s: unknown) => Promise.resolve(s)),
    };
    service = new SponsorService(
      sponsorRepo as unknown as Repository<Sponsor>,
      {} as MailtrapContactsService,
      {} as ChildrenService,
      { send: jest.fn() } as unknown as MailService,
    );
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

  describe('updatePreferences', () => {
    it('applies the fields and stamps preferencesCompletedAt', async () => {
      sponsorRepo.findOne.mockResolvedValue({
        id: 's1',
        childInterests: null,
        preferencesCompletedAt: null,
      });

      const result = await service.updatePreferences('s1', {
        childInterests: 'Sports and music',
      });

      expect(result.childInterests).toBe('Sports and music');
      expect(result.preferencesCompletedAt).toBeInstanceOf(Date);
    });
  });
});
