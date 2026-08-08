export interface Child {
  id: string;
  name: string;
  age: number;
  gender: string;
  dateOfBirth: string;
  bio: string;
  imageUrl: string;
  subject: string;
  dream: string;
  hobby: string;
  personality: string;
  family: string;
  location: string;
  uniqueQuality: string;
  schoolName: string;
  schoolLevel: string;
  schoolYearGroup: string;
  enrolmentDate: string;
  guardianName: string;
  guardianRelationship: string;
  guardianConsent: boolean;
  photoConsentStatus: boolean;
  sponsorshipStartDate: string | null;
}

export const children: Child[] = [
  {
    id: 'child-001',
    name: 'Amara Uwimana',
    age: 8,
    gender: 'Female',
    dateOfBirth: '2017-03-14',
    bio: 'Amara loves drawing and dreams of becoming an architect. She lives with her grandmother and is one of the brightest students in her class.',
    imageUrl: '/img/kid.jpg',
    subject: 'Mathematics',
    dream: 'Architect',
    hobby: 'drawing and painting',
    personality: 'creative and determined',
    family: 'her grandmother',
    location: 'Kimironko',
    uniqueQuality: 'her ability to turn everyday objects into beautiful art',
    schoolName: 'EP Kacyiru I',
    schoolLevel: 'Primary',
    schoolYearGroup: 'P3',
    enrolmentDate: '2022-01-10',
    guardianName: 'Esperance Uwimana',
    guardianRelationship: 'GrandParents',
    guardianConsent: true,
    photoConsentStatus: true,
    sponsorshipStartDate: null,
  },
  {
    id: 'child-002',
    name: 'Jean-Pierre Nshimiyimana',
    age: 10,
    gender: 'Male',
    dateOfBirth: '2015-07-22',
    bio: 'Jean-Pierre is passionate about football and science. Despite facing hardship at home, he maintains excellent grades and inspires his peers.',
    imageUrl: '/img/playing.jpg',
    subject: 'Science',
    dream: 'Scientist',
    hobby: 'football and experiments',
    personality: 'curious and resilient',
    family: 'his uncle and aunt',
    location: 'Kicukiro',
    uniqueQuality: 'his incredible drive to learn despite every challenge',
    schoolName: 'GS Kagugu Catholic',
    schoolLevel: 'Primary',
    schoolYearGroup: 'P5',
    enrolmentDate: '2021-01-10',
    guardianName: 'Damascene Nshimiyimana',
    guardianRelationship: 'Father',
    guardianConsent: true,
    photoConsentStatus: true,
    sponsorshipStartDate: null,
  },
  {
    id: 'child-003',
    name: 'Claudine Mukamana',
    age: 7,
    gender: 'Female',
    dateOfBirth: '2018-11-05',
    bio: 'Claudine is a cheerful and curious girl who loves singing and reading. She is eager to learn and brings joy to everyone around her.',
    imageUrl: '/img/children.jpg',
    subject: 'Music',
    dream: 'Singer',
    hobby: 'singing and reading storybooks',
    personality: 'cheerful and kind',
    family: 'her mother and younger brother',
    location: 'Nyamirambo',
    uniqueQuality: 'the joy she brings to everyone around her with her smile',
    schoolName: 'GS Rugando',
    schoolLevel: 'Primary',
    schoolYearGroup: 'P2',
    enrolmentDate: '2023-01-10',
    guardianName: 'Vestine Mukamana',
    guardianRelationship: 'Mother',
    guardianConsent: true,
    photoConsentStatus: false,
    sponsorshipStartDate: null,
  },
  {
    id: 'child-004',
    name: 'Eric Habimana',
    age: 11,
    gender: 'Male',
    dateOfBirth: '2014-05-18',
    bio: 'Eric wants to be a doctor to help his community. He takes care of his younger siblings and never misses a day of school.',
    imageUrl: '/img/group1.jpg',
    subject: 'Biology',
    dream: 'Doctor',
    hobby: 'reading and caring for others',
    personality: 'responsible and compassionate',
    family: 'his mother and three younger siblings',
    location: 'Gisozi',
    uniqueQuality:
      'his selfless dedication to family and community from such a young age',
    schoolName: 'GS Gisozi II',
    schoolLevel: 'Primary',
    schoolYearGroup: 'P6',
    enrolmentDate: '2020-01-10',
    guardianName: 'Annonciata Habimana',
    guardianRelationship: 'Mother',
    guardianConsent: true,
    photoConsentStatus: true,
    sponsorshipStartDate: null,
  },
  {
    id: 'child-005',
    name: 'Solange Ingabire',
    age: 9,
    gender: 'Female',
    dateOfBirth: '2016-09-30',
    bio: 'Solange is a talented dancer and an enthusiastic learner. She hopes her education will one day allow her to support her family.',
    imageUrl: '/img/dance.jpg',
    subject: 'Dance & Arts',
    dream: 'Professional Dancer',
    hobby: 'dancing and crafting',
    personality: 'energetic and talented',
    family: 'her grandmother and cousin',
    location: 'Remera',
    uniqueQuality:
      'her extraordinary talent for dance that lights up every room she enters',
    schoolName: 'EPAK DON Bosco',
    schoolLevel: 'Primary',
    schoolYearGroup: 'P4',
    enrolmentDate: '2022-01-10',
    guardianName: 'Beatrice Ingabire',
    guardianRelationship: 'GrandParents',
    guardianConsent: true,
    photoConsentStatus: true,
    sponsorshipStartDate: null,
  },
];
