import { Injectable } from '@nestjs/common';
import { ConsentStatus } from '../enums/child.enums';
import { CsvRecord } from './csv-parser';

@Injectable()
export class ChildCsvMapper {
  normalize(raw: CsvRecord) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const kcfNumber = this.clean(raw['Number']);
    const name = this.clean(raw['Full name']);
    if (!kcfNumber) errors.push('Number is required');
    if (!name) errors.push('Full name is required');
    const dateOfBirth = this.date(raw['Date of Birth'], 'Date of Birth', errors);
    const enrolmentDate = this.date(raw['KCF Enrolment date'], 'KCF Enrolment date', errors);
    const sponsorshipDate = this.date(raw['Sponsorship start date'], 'Sponsorship start date', errors);
    if (sponsorshipDate && this.clean(raw['Sponsor status']).toLowerCase() === 'not yet') {
      warnings.push('Sponsorship start date conflicts with sponsor status; sponsorship data was not imported');
    }
    const relationship = this.clean(raw["Guardian's relationship"]);
    const guardianName = this.clean(raw['Guardian name']);
    const educationPresent = ['School name', 'School level', 'School year group'].some((key) => this.clean(raw[key]));
    return {
      normalized: {
        kcfNumber, name, gender: this.clean(raw['Gender']) || undefined,
        dateOfBirth: dateOfBirth || undefined, enrolmentDate: enrolmentDate || undefined,
        education: educationPresent ? {
          schoolName: this.clean(raw['School name']) || undefined,
          schoolLevel: this.clean(raw['School level']) || undefined,
          yearGroup: this.clean(raw['School year group']) || undefined,
        } : undefined,
        guardians: relationship ? [{ name: guardianName || undefined, relationship, isPrimary: true }] : undefined,
        consent: {
          guardian: this.consent(raw['Guardian consent']),
          photo: this.consent(raw['Photo consent status']),
          notes: 'Imported from KCF child record CSV',
        },
      },
      errors, warnings,
    };
  }

  private clean(value?: string) { return (value ?? '').trim().replace(/\s+/g, ' '); }
  private consent(value?: string) {
    const normalized = this.clean(value).toLowerCase();
    if (['yes', 'true', 'granted'].includes(normalized)) return ConsentStatus.GRANTED;
    if (['no', 'false', 'denied'].includes(normalized)) return ConsentStatus.DENIED;
    return ConsentStatus.PENDING;
  }
  private date(value: string | undefined, field: string, errors: string[]) {
    const clean = this.clean(value);
    if (!clean) return null;
    // Parse at UTC noon so a positive/negative server timezone cannot shift
    // date-only values to the previous or next calendar day.
    const date = new Date(`${clean} 12:00:00 UTC`);
    if (Number.isNaN(date.getTime())) { errors.push(`${field} is invalid`); return null; }
    return date.toISOString().slice(0, 10);
  }
}
