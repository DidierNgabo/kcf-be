import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/enums/user-role.enum';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };

  beforeEach(() => {
    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    usersService = { findById: jest.fn() };
    strategy = new JwtStrategy(config, usersService as unknown as UsersService);
  });

  const basePayload = {
    sub: 'user-1',
    email: 'admin@kcf.org',
    role: UserRole.ADMIN,
    sponsorId: null,
  };

  it('rejects when the user no longer exists', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ ...basePayload, iat: 1000 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an inactive user', async () => {
    usersService.findById.mockResolvedValue({
      ...basePayload,
      id: 'user-1',
      name: 'Admin',
      isActive: false,
      passwordChangedAt: null,
    });

    await expect(
      strategy.validate({ ...basePayload, iat: 1000 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token issued before the most recent password change', async () => {
    const passwordChangedAt = new Date('2026-01-01T00:00:00.000Z');
    usersService.findById.mockResolvedValue({
      ...basePayload,
      id: 'user-1',
      name: 'Admin',
      isActive: true,
      passwordChangedAt,
    });
    const issuedBeforeChange =
      Math.floor(passwordChangedAt.getTime() / 1000) - 60;

    await expect(
      strategy.validate({ ...basePayload, iat: issuedBeforeChange }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a token issued after the most recent password change', async () => {
    const passwordChangedAt = new Date('2026-01-01T00:00:00.000Z');
    const user = {
      ...basePayload,
      id: 'user-1',
      name: 'Admin',
      isActive: true,
      passwordChangedAt,
    };
    usersService.findById.mockResolvedValue(user);
    const issuedAfterChange =
      Math.floor(passwordChangedAt.getTime() / 1000) + 60;

    const result = await strategy.validate({
      ...basePayload,
      iat: issuedAfterChange,
    });

    expect(result).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sponsorId: user.sponsorId,
    });
  });

  it('accepts a token when passwordChangedAt has never been tracked', async () => {
    const user = {
      ...basePayload,
      id: 'user-1',
      name: 'Admin',
      isActive: true,
      passwordChangedAt: null,
    };
    usersService.findById.mockResolvedValue(user);

    const result = await strategy.validate({ ...basePayload, iat: 1 });

    expect(result.id).toBe(user.id);
  });
});
