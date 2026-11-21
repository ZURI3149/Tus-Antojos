import { Body, Controller, Post } from '@nestjs/common';
import { registerPurchaseSchema, type RegisterPurchase } from '@tus-antojos/shared';
import type { AuthUser } from '../../auth/auth-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { PurchasesService } from './purchases.service.js';

@Roles('admin')
@Controller('inventory/purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post()
  register(
    @Body(new ZodValidationPipe(registerPurchaseSchema)) body: RegisterPurchase,
    @CurrentUser() user: AuthUser,
  ): Promise<{ id: string }> {
    return this.purchases.register(body, user.id);
  }
}
