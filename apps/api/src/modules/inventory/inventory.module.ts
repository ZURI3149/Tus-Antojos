import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { AdjustmentsController } from './adjustments.controller.js';
import { AdjustmentsService } from './adjustments.service.js';
import { PurchasesController } from './purchases.controller.js';
import { PurchasesService } from './purchases.service.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StockController, PurchasesController, AdjustmentsController],
  providers: [StockService, PurchasesService, AdjustmentsService],
  exports: [StockService, PurchasesService, AdjustmentsService],
})
export class InventoryModule {}
