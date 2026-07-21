import { IsEmail, IsString, IsNotEmpty, MinLength, Matches, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include upper, lower, and a number',
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  companyName: string;

  /** Ignored server-side — new companies always start on STARTER */
  @IsOptional()
  @IsString()
  plan?: string;
}
