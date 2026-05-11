import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class MatchSponsorDto {
  @IsString()
  @IsNotEmpty()
  sponsorName: string;

  @IsEmail()
  sponsorEmail: string;

  @IsString()
  @IsNotEmpty()
  childId: string;
}
