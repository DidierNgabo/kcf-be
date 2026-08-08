import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export const STAFF_ROLES = [
  UserRole.ADMIN,
  UserRole.STAFF,
  UserRole.SPONSORSHIP_MANAGER,
] as const;

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(STAFF_ROLES)
  role: UserRole;
}
