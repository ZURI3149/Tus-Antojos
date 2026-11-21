import { Body, Controller, Post } from '@nestjs/common';
import {
  countStockSchema,
  recordWasteSchema,
  type CountStockInput,
  type InventoryMovement,
  type RecordWasteInput,
} from '@tus-antojos/shared';
import type { AuthUser } from '../../auth/auth-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AdjustmentsService } from './adjustments.service.js';

@Roles('admin')
@Controller('inventory')
export class AdjustmentsController {
  constructor(private readonly adjustments: AdjustmentsService) {}

  @Post('waste')
  recordWaste(
    @Body(new ZodValidationPipe(recordWasteSchema)) body: RecordWasteInput,
    @CurrentUser() user: AuthUser,
  ): Promise<InventoryMovement> {
    return this.adjustments.recordWaste(body, user.id);
  }

  @Post('counts')
  countStock(
    @Body(new ZodValidationPipe(countStockSchema)) body: CountStockInput,
    @CurrentUser() user: AuthUser,
  ): Promise<InventoryMovement> {
    return this.adjustments.countStock(body, user.id);
  }
}
