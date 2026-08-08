import { ChildCsvMapper } from './child-csv.mapper';
import { ConsentStatus } from '../enums/child.enums';

describe('ChildCsvMapper', () => {
  const mapper = new ChildCsvMapper();

  it('normalizes the KCF CSV shape without importing sponsorship fields', () => {
    const result = mapper.normalize({
      Number: ' 0001-2020 ',
      'Full name': 'Jane   Doe',
      Gender: 'Female',
      'Date of Birth': 'June 16, 2013',
      'School name': 'KCF School',
      'School level': 'Primary',
      'School year group': 'P5',
      "Guardian's relationship": 'Mother',
      'Guardian name': 'Mary Doe',
      'Guardian consent': 'No',
      'Photo consent status': 'Yes',
      'Sponsor status': 'Not yet',
      'Sponsorship start date': 'January 1, 2024',
    });

    expect(result.normalized).toMatchObject({
      kcfNumber: '0001-2020',
      name: 'Jane Doe',
      dateOfBirth: '2013-06-16',
      education: { schoolName: 'KCF School', schoolLevel: 'Primary', yearGroup: 'P5' },
      consent: { guardian: ConsentStatus.DENIED, photo: ConsentStatus.GRANTED },
    });
    expect(result.normalized).not.toHaveProperty('sponsorshipStartDate');
    expect(result.warnings).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('marks missing business identifiers and malformed dates invalid', () => {
    const result = mapper.normalize({ Number: '', 'Full name': '', 'Date of Birth': 'not-a-date' });
    expect(result.errors).toEqual(expect.arrayContaining(['Number is required', 'Full name is required', 'Date of Birth is invalid']));
  });
});
