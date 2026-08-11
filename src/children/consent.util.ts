import { ChildConsent } from './entities/child-consent.entity';
import { ConsentStatus, ConsentType } from './enums/child.enums';

export function latestConsentStatus(
  consents: ChildConsent[] | undefined,
  type: ConsentType,
): ConsentStatus {
  return (
    consents
      ?.filter((item) => item.type === type)
      .sort((a, b) => +new Date(b.effectiveAt) - +new Date(a.effectiveAt))[0]
      ?.status ?? ConsentStatus.PENDING
  );
}

export function hasGrantedConsent(
  consents: ChildConsent[] | undefined,
  type: ConsentType,
): boolean {
  return latestConsentStatus(consents, type) === ConsentStatus.GRANTED;
}
