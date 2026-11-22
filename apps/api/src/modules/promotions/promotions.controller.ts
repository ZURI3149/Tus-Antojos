import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import {
  createPromotionSchema,
  updatePromotionSchema,
  type CreatePromotion,
  type UpdatePromotion,
} from '@tus-antojos/shared';
import { z } from 'zod';
import type { AuthUser } from '../../auth/auth-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { PromotionsService } from './promotions.service.js';

@Roles('admin')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createPromotionSchema)) body: CreatePromotion,
    @CurrentUser() user: AuthUser,
  ): Promise<{ id: string }> {
    return this.promotions.create(body, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(z.guid())) id: string,
    @Body(new ZodValidationPipe(updatePromotionSchema)) body: UpdatePromotion,
  ): Promise<{ id: string }> {
    return this.promotions.update(id, body);
  }
}
