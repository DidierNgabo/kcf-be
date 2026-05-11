export interface Child {
  id: string;
  name: string;
  age: number;
  bio: string;
  imageUrl: string;
}

export const children: Child[] = [
  {
    id: 'child-001',
    name: 'Amara Uwimana',
    age: 8,
    bio: 'Amara loves drawing and dreams of becoming an architect. She lives with her grandmother and is one of the brightest students in her class.',
    imageUrl: '/img/kid.jpg',
  },
  {
    id: 'child-002',
    name: 'Jean-Pierre Nshimiyimana',
    age: 10,
    bio: 'Jean-Pierre is passionate about football and science. Despite facing hardship at home, he maintains excellent grades and inspires his peers.',
    imageUrl: '/img/playing.jpg',
  },
  {
    id: 'child-003',
    name: 'Claudine Mukamana',
    age: 7,
    bio: 'Claudine is a cheerful and curious girl who loves singing and reading. She is eager to learn and brings joy to everyone around her.',
    imageUrl: '/img/children.jpg',
  },
  {
    id: 'child-004',
    name: 'Eric Habimana',
    age: 11,
    bio: 'Eric wants to be a doctor to help his community. He takes care of his younger siblings and never misses a day of school.',
    imageUrl: '/img/group1.jpg',
  },
  {
    id: 'child-005',
    name: 'Solange Ingabire',
    age: 9,
    bio: 'Solange is a talented dancer and an enthusiastic learner. She hopes her education will one day allow her to support her family.',
    imageUrl: '/img/dance.jpg',
  },
];
