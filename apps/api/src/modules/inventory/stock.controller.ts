import { Body, Controller, Param, Patch } from '@nestjs/common';
import { updateStockSchema, type StockItem, type UpdateStockInput } from '@tus-antojos/shared';
import { z } from 'zod';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { StockService } from './stock.service.js';

@Roles('admin')
@Controller('inventory/stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Patch(':ingredientId')
  updateMinQuantity(
    @Param('ingredientId', new ZodValidationPipe(z.guid())) ingredientId: string,
    @Body(new ZodValidationPipe(updateStockSchema)) body: UpdateStockInput,
  ): Promise<StockItem> {
    return this.stock.updateMinQuantity(ingredientId, body);
  }
}
