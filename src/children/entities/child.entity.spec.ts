import { Child } from './child.entity';

describe('Child age', () => {
  it('derives age from date of birth instead of storing it', () => {
    const child = new Child();
    const today = new Date();
    child.dateOfBirth = new Date(Date.UTC(today.getUTCFullYear() - 10, today.getUTCMonth(), today.getUTCDate()));
    expect(child.age).toBe(10);
  });

  it('returns null when date of birth is unknown', () => {
    const child = new Child();
    child.dateOfBirth = null;
    expect(child.age).toBeNull();
  });
});
