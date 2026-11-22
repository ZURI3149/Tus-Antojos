import { Injectable, Logger } from '@nestjs/common';
import type { CreateOrder, Json, Order, OrderStatus } from '@tus-antojos/shared';
import { canTransition } from '@tus-antojos/shared';
import type { AuthUser } from '../../auth/auth-user.js';
import { AppException } from '../../common/app-exception.js';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { ordersError } from './orders-error.js';

export interface CreateOrderResult extends Order {
  replayed: boolean;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async create(input: CreateOrder, cashierId: string): Promise<CreateOrderResult> {
    this.logger.log({
      msg: 'Creando pedido',
      clientOrderId: input.clientOrderId,
      itemsCount: input.items.length,
      paymentMethod: input.paymentMethod,
    });

    const { data, error } = await this.supabase.admin.rpc('create_order', {
      p_client_order_id: input.clientOrderId,
      p_items: input.items as unknown as Json,
      p_payment_method: input.paymentMethod,
      p_cashier_id: cashierId,
      p_created_offline_at: input.createdOfflineAt ?? undefined,
    });

    if (error) {
      this.logger.warn({
        msg: 'Fallo al crear pedido',
        clientOrderId: input.clientOrderId,
        error,
      });
      throw ordersError(error);
    }

    const result = data as unknown as CreateOrderResult;
    this.logger.log({
      msg: 'Pedido registrado con éxito',
      clientOrderId: input.clientOrderId,
      orderId: result.id,
      orderNumber: result.orderNumber,
      replayed: result.replayed,
    });

    return result;
  }

  async advanceStatus(id: string, to: OrderStatus, user: AuthUser): Promise<Order> {
    // 1. Obtener estado actual para validar autorización del rol según canTransition
    const { data: order, error: findError } = await this.supabase.admin
      .from('orders')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      // Fallo real de la BD (no "no existe"): 500 + log, no un 404 engañoso.
      this.logger.error({ msg: 'Fallo al leer el pedido', orderId: id, error: findError });
      throw ordersError(findError);
    }
    if (!order) {
      throw new AppException('NOT_FOUND', 'Pedido no encontrado');
    }

    if (!canTransition(user.role, order.status, to)) {
      throw new AppException(
        'FORBIDDEN',
        `El rol ${user.role} no tiene permiso para cambiar el pedido de ${order.status} a ${to}`,
      );
    }

    const { data, error } = await this.supabase.admin.rpc('advance_order_status', {
      p_order_id: id,
      p_to_status: to,
      p_user_id: user.id,
    });

    if (error) throw ordersError(error);
    return data as unknown as Order;
  }

  async cancel(id: string, reason: string, user: AuthUser): Promise<Order> {
    const onlyCashier = user.role === 'cajero' ? user.id : undefined;

    const { data, error } = await this.supabase.admin.rpc('cancel_order', {
      p_order_id: id,
      p_reason: reason,
      p_user_id: user.id,
      p_only_cashier: onlyCashier,
    });

    if (error) throw ordersError(error);
    return data as unknown as Order;
  }
}
