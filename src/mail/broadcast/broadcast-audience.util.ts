import { IsNull, Not, Repository } from 'typeorm';
import { Sponsor } from '../../sponsor/entities/sponsor.entity';
import { BroadcastAudience } from '../dto/broadcast-send.dto';

// Sponsors have no status/segment field — matched vs unmatched is derived
// from whether they have a child assigned. Unsubscribed sponsors are always
// excluded regardless of the chosen segment.
export function resolveAudienceSponsors(
  sponsorRepo: Repository<Sponsor>,
  audience: BroadcastAudience,
): Promise<Sponsor[]> {
  const child =
    audience === 'matched'
      ? Not(IsNull())
      : audience === 'unmatched'
        ? IsNull()
        : undefined;
  return sponsorRepo.find({
    where: { unsubscribed: false, ...(child ? { child } : {}) },
  });
}

export function buildUnsubscribeUrl(unsubscribeToken: string): string {
  const frontendUrl = process.env.MIS_FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
}
