import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ChildStatus } from '../enums/child.enums';

export class QueryChildrenDto {
  @IsString() @IsOptional() search?: string;
  @IsEnum(ChildStatus) @IsOptional() status?: ChildStatus;
  @IsString() @IsOptional() gender?: string;
  @IsString() @IsOptional() schoolLevel?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() limit = 20;
  @IsIn(['name', 'kcfNumber', 'dateOfBirth', 'createdAt']) @IsOptional() sortBy = 'name';
  @IsIn(['ASC', 'DESC']) @IsOptional() sortOrder: 'ASC' | 'DESC' = 'ASC';
}
