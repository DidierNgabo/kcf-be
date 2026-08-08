import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../users/enums/user-role.enum';

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  function contextWithUser(user: unknown): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('allows the request when no @Roles() metadata is present', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser({ role: UserRole.STAFF }))).toBe(
      true,
    );
  });

  it('allows the request when the user role matches', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
      UserRole.SPONSORSHIP_MANAGER,
    ]);
    expect(
      guard.canActivate(
        contextWithUser({ role: UserRole.SPONSORSHIP_MANAGER }),
      ),
    ).toBe(true);
  });

  it('denies the request when the user role does not match', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);
    expect(guard.canActivate(contextWithUser({ role: UserRole.STAFF }))).toBe(
      false,
    );
  });

  it('denies the request when there is no authenticated user', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(false);
  });
});
