import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUser,
  type UpdateUser,
  type User,
} from '@tus-antojos/shared';
import { z } from 'zod';
import type { AuthUser } from '../../auth/auth-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(): Promise<User[]> {
    return this.users.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUser): Promise<User> {
    return this.users.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(z.guid())) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUser,
    @CurrentUser() actor: AuthUser,
  ): Promise<User> {
    return this.users.update(id, body, actor.id);
  }
}
