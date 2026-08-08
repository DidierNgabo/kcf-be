import { UserRole } from '../../users/enums/user-role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sponsorId: string | null;
}
