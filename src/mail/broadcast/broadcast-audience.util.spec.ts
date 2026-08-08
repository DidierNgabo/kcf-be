import { IsNull, Not, Repository } from 'typeorm';
import { Sponsor } from '../../sponsor/entities/sponsor.entity';
import {
  buildUnsubscribeUrl,
  resolveAudienceSponsors,
} from './broadcast-audience.util';

describe('resolveAudienceSponsors', () => {
  let sponsorRepo: { find: jest.Mock };

  beforeEach(() => {
    sponsorRepo = { find: jest.fn().mockResolvedValue([]) };
  });

  it('excludes unsubscribed sponsors regardless of audience', async () => {
    await resolveAudienceSponsors(
      sponsorRepo as unknown as Repository<Sponsor>,
      'all',
    );
    expect(sponsorRepo.find).toHaveBeenCalledWith({
      where: { unsubscribed: false },
    });
  });

  it('filters to sponsors with a matched child', async () => {
    await resolveAudienceSponsors(
      sponsorRepo as unknown as Repository<Sponsor>,
      'matched',
    );
    expect(sponsorRepo.find).toHaveBeenCalledWith({
      where: { unsubscribed: false, child: Not(IsNull()) },
    });
  });

  it('filters to sponsors with no matched child', async () => {
    await resolveAudienceSponsors(
      sponsorRepo as unknown as Repository<Sponsor>,
      'unmatched',
    );
    expect(sponsorRepo.find).toHaveBeenCalledWith({
      where: { unsubscribed: false, child: IsNull() },
    });
  });
});

describe('buildUnsubscribeUrl', () => {
  const originalEnv = process.env.MIS_FRONTEND_URL;
  afterEach(() => {
    process.env.MIS_FRONTEND_URL = originalEnv;
  });

  it('builds a link against MIS_FRONTEND_URL with the token URL-encoded', () => {
    process.env.MIS_FRONTEND_URL = 'https://mis.kcf.org';
    expect(buildUnsubscribeUrl('abc-123')).toBe(
      'https://mis.kcf.org/unsubscribe?token=abc-123',
    );
  });

  it('falls back to localhost when MIS_FRONTEND_URL is unset', () => {
    delete process.env.MIS_FRONTEND_URL;
    expect(buildUnsubscribeUrl('tok')).toBe(
      'http://localhost:3000/unsubscribe?token=tok',
    );
  });
});
