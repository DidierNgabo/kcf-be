import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/enums/user-role.enum';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmailWithPassword: jest.Mock };
  let jwtService: { sign: jest.Mock };

  const activeUser = {
    id: 'user-1',
    email: 'admin@kcf.org',
    password: 'hashed-password',
    name: 'Admin',
    role: UserRole.ADMIN,
    isActive: true,
    sponsorId: null,
  };

  beforeEach(async () => {
    usersService = { findByEmailWithPassword: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.resetAllMocks());

  it('issues a token for valid credentials', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(activeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: activeUser.email,
      password: 'correct-password',
    });

    expect(result.accessToken).toBe('signed-jwt');
    expect(result.user).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      name: activeUser.name,
      role: activeUser.role,
      sponsorId: null,
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
      sponsorId: null,
    });
  });

  it('rejects an unknown email', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@kcf.org', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a wrong password', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(activeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: activeUser.email, password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an inactive user', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      ...activeUser,
      isActive: false,
    });

    await expect(
      service.login({ email: activeUser.email, password: 'correct-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
