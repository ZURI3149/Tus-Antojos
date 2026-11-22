import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  advanceOrderStatusSchema,
  cancelOrderSchema,
  createOrderSchema,
  type AdvanceOrderStatusInput,
  type CancelOrderInput,
  type CreateOrder,
  type Order,
} from '@tus-antojos/shared';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthUser } from '../../auth/auth-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { AppException } from '../../common/app-exception.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Roles('cajero', 'admin')
  async create(
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrder,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Order> {
    if (idempotencyKey && idempotencyKey.toLowerCase() !== body.clientOrderId.toLowerCase()) {
      throw new AppException(
        'VALIDATION_ERROR',
        'El encabezado Idempotency-Key no coincide con clientOrderId',
      );
    }

    const result = await this.orders.create(body, user.id);
    if (result.replayed) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }

    const { replayed, ...order } = result;
    return order as Order;
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles('cocina', 'cajero', 'admin')
  async advanceStatus(
    @Param('id', new ZodValidationPipe(z.guid({ error: 'ID de pedido inválido' }))) id: string,
    @Body(new ZodValidationPipe(advanceOrderStatusSchema)) body: AdvanceOrderStatusInput,
    @CurrentUser() user: AuthUser,
  ): Promise<Order> {
    return this.orders.advanceStatus(id, body.to, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('cajero', 'admin')
  async cancel(
    @Param('id', new ZodValidationPipe(z.guid({ error: 'ID de pedido inválido' }))) id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema)) body: CancelOrderInput,
    @CurrentUser() user: AuthUser,
  ): Promise<Order> {
    return this.orders.cancel(id, body.reason, user);
  }
}
