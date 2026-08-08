# kcf-backend

Backend API for Kwizera Charity Foundation (KCF) — manages sponsored children profiles and sponsor relationships.

## Tech stack

- **NestJS v11** (TypeScript) on Express, feature-module architecture (Controller → Service → TypeORM Repository/Entity per module — not classic MVC).
- **PostgreSQL + TypeORM** (`@nestjs/typeorm`). Production schema changes use migrations in `src/database/migrations`; `TYPEORM_SYNCHRONIZE` is disabled by default and local-development-only. New entities must be registered in the root TypeORM configuration and the CLI data source.
- **class-validator** / **class-transformer** for DTO validation (`ValidationPipe({ whitelist: true })` is global, set in `main.ts`).
- **Mailtrap** (`mailtrap` SDK) for transactional email, with **Handlebars** templates rendered from each module's `templates/*.hbs` directory (see `sponsor/templates/`). `nest-cli.json`'s asset glob copies `**/*.hbs` (and other non-`.ts` assets) into `dist/` on build.
- **Jest** for tests: unit specs colocated as `src/**/*.spec.ts` (config lives in `package.json`'s `"jest"` key, `rootDir: "src"`), e2e specs in `test/*.e2e-spec.ts` (run via `npm run test:e2e`, config in `test/jest-e2e.json`).
- No API versioning, no global route prefix — controllers are plain `@Controller('feature-name')`.

## Project structure

```
src/
  app.module.ts     # TypeOrmModule.forRoot(...), registers all feature modules + entities
  main.ts            # bootstrap: enableCors(), global ValidationPipe
  data/children.ts   # static seed data
  children/          # child profiles module
  sponsor/           # sponsor CRM + matching + follow-up emails module
  users/             # user accounts + roles (auth)
  auth/              # login, JWT, guards, decorators (auth)
```

Each feature module follows: `feature.module.ts`, `feature.controller.ts` (thin, delegates to service), `feature.service.ts` (all business logic), `entities/*.entity.ts`, `dto/*.dto.ts` (class-validator decorated). Services log via `private readonly logger = new Logger(ServiceName.name)`.

## Authentication & Authorization

The API is **protected by default**. Every route requires a valid JWT unless explicitly marked `@Public()`; role-restricted routes additionally require `@Roles(...)`.

### Architecture

- Single JWT access token (no refresh token), signed via `@nestjs/jwt`, sent as `Authorization: Bearer <token>`. Expiry controlled by `JWT_EXPIRES_IN` (default `7d`).
- `JwtAuthGuard` and `RolesGuard` (`src/auth/guards/`) are registered **globally** via `APP_GUARD` in `src/auth/auth.module.ts` — no per-controller guard wiring needed anywhere in the app.
- `@Public()` (`src/auth/decorators/public.decorator.ts`) opts a route out of authentication entirely.
- `@Roles(UserRole.X, UserRole.Y)` (`src/auth/decorators/roles.decorator.ts`) restricts an otherwise-authenticated route to specific roles. **No `@Roles()` on a route means any authenticated user may call it** — `@Roles()` is an additive restriction on top of authentication, not a separate opt-in gate.
- `@CurrentUser()` (`src/auth/decorators/current-user.decorator.ts`) injects the authenticated user (`{ id, email, name, role, sponsorId }`) into a handler — always use this to scope a sponsor's own data, never a client-supplied ID.
- `JwtStrategy` re-validates the user against the database on every request (not just the JWT payload), so deactivating a user or changing their role takes effect immediately instead of waiting out the token's lifetime.
- Passwords are hashed with `bcrypt` exclusively in `UsersService` (service-layer, no entity lifecycle hooks — matches this codebase's convention of keeping logic in services).
- There is **no public self-service signup**. Every account (staff, admin, sponsorship_manager, sponsor) is provisioned by an existing `admin`/`sponsorship_manager` via `UsersController`. The very first admin account is created by `UsersService.onModuleInit()` from `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` env vars (idempotent — no-ops once any admin exists; unset/rotate these after first boot).
- Both `POST /users` and `POST /users/sponsor-accounts` accept an **optional** password — if omitted, `UsersService` auto-generates one and always emails the credentials via Mailtrap (`staff-invitation.hbs` / `account-provisioned.hbs`), returning `{ user, temporaryPassword, emailSent }` (never just a bare user). A failed email send never fails account creation (`emailSent: false` instead).

### Password reset

- `POST /auth/forgot-password` (`@Public()`) and `POST /auth/reset-password` (`@Public()`) implement a full self-service flow — see `UsersService.requestPasswordReset()` / `resetPassword()`.
- Reset tokens: a random token is emailed (`password-reset.hbs`, link built from `MIS_FRONTEND_URL`), but only its `sha256` hash is ever persisted (`User.passwordResetTokenHash`, `select: false` — same hygiene as `password`). Single-use (cleared on success) and expire after 1 hour (`User.passwordResetExpiresAt`).
- `forgot-password` always returns the same generic response whether or not the email matches an account (prevents user enumeration — same principle as `login`'s uniform "Invalid credentials" message).
- `User.passwordChangedAt` is set on every password set (initial creation, sponsor-account provisioning, and reset) and checked by `JwtStrategy` against the JWT's `iat` claim — a token issued before the most recent password change is rejected. Without this, a reset triggered by a leaked password wouldn't actually invalidate the leaked token until it naturally expired (up to 7 days).

### Roles

| Role | Access |
|---|---|
| `admin` | Full access to everything. |
| `staff` | Operational access: children, attendance*, statistics*, queries/interest submissions*. **No** sponsor/sponsorship management. |
| `sponsorship_manager` | Everything `staff` has, **plus** sponsor & sponsorship management. |
| `sponsor` | Only their own sponsor record and the child(ren) they sponsor, via `GET /sponsor/me`. No access to other sponsors, operational, or staff data. |

\* `attendance` and `statistics` modules don't exist yet — this row documents intended access for when they're built. Apply the same `@Roles()` pattern used on `children`/`sponsor` below.

### Current RBAC matrix (implemented)

| Route | admin | staff | sponsorship_manager | sponsor |
|---|:---:|:---:|:---:|:---:|
| `GET /` | public | public | public | public |
| `GET /children`, `GET /children/:id` | public | public | public | public |
| `POST /children`, `PATCH /children/:id` | ✓ | ✓ | ✓ | – |
| `GET /sponsor` (list all) | ✓ | – | ✓ | – |
| `POST /sponsor` (public interest form) | public | public | public | public |
| `POST /sponsor/match`, `PATCH /sponsor/:id` | ✓ | – | ✓ | – |
| `GET /sponsor/me` | – | – | – | ✓ (own record only) |
| `POST /users`, `GET /users`, `GET /users/:id` | ✓ | – | – | – |
| `POST /users/sponsor-accounts` (provision a sponsor login) | ✓ | – | ✓ | – |
| `POST /auth/login` | public | public | public | public |
| `GET /auth/me` | any authenticated user |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | public | public | public | public |

### Conventions for future modules (e.g. attendance, statistics)

1. **Default-protect**: add no annotation and the route requires *any* valid login. Only add `@Public()` if the route is genuinely meant to be unauthenticated.
2. Use `@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SPONSORSHIP_MANAGER)` (i.e. everything except `sponsor`) for operational endpoints, matching the `staff` access row above.
3. Never let a `sponsor`-role user query by arbitrary ID for resources scoped to another party (child, sponsor, attendance record). Instead, read `sponsorId` off `@CurrentUser()` and build a dedicated `/me`-style, self-scoped endpoint, following the `GET /sponsor/me` precedent in `src/sponsor/sponsor.controller.ts`.
4. Hash passwords with `bcrypt` in the service layer (never an entity hook), using the `SALT_ROUNDS` constant pattern in `src/users/users.service.ts`.
5. New user-facing accounts are always provisioned by an existing `admin`/`sponsorship_manager` via `UsersController` — there is no public self-service signup.
