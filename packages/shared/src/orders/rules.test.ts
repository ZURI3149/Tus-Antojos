import { describe, expect, it } from 'vitest';
import { canCancel, canTransition, orderRuleMessage } from './rules';

describe('order rules messages', () => {
  it('traduce códigos de negocio a español', () => {
    expect(orderRuleMessage('ORDER_NOT_FOUND')).toBe('El pedido no existe');
    expect(orderRuleMessage('PRODUCT_INACTIVE')).toBe('El producto no está activo para la venta');
    expect(orderRuleMessage('UNKNOWN_CODE')).toBeUndefined();
  });
});

describe('canTransition', () => {
  it('permite reintentos del mismo estado a cualquier rol', () => {
    expect(canTransition('cocina', 'en_preparacion', 'en_preparacion')).toBe(true);
    expect(canTransition('cajero', 'pendiente', 'pendiente')).toBe(true);
  });

  it('cocina solo puede avanzar de pendiente a en_preparacion y de en_preparacion a listo', () => {
    expect(canTransition('cocina', 'pendiente', 'en_preparacion')).toBe(true);
    expect(canTransition('cocina', 'en_preparacion', 'listo')).toBe(true);
    expect(canTransition('cocina', 'listo', 'entregado')).toBe(false);
    expect(canTransition('cocina', 'pendiente', 'listo')).toBe(false);
  });

  it('cajero solo puede marcar como entregado un pedido listo', () => {
    expect(canTransition('cajero', 'listo', 'entregado')).toBe(true);
    expect(canTransition('cajero', 'pendiente', 'en_preparacion')).toBe(false);
    expect(canTransition('cajero', 'en_preparacion', 'listo')).toBe(false);
  });

  it('admin puede realizar cualquiera de las 3 transiciones hacia adelante', () => {
    expect(canTransition('admin', 'pendiente', 'en_preparacion')).toBe(true);
    expect(canTransition('admin', 'en_preparacion', 'listo')).toBe(true);
    expect(canTransition('admin', 'listo', 'entregado')).toBe(true);
    expect(canTransition('admin', 'entregado', 'pendiente')).toBe(false);
  });
});

describe('canCancel', () => {
  const today = '2026-11-22';
  const myId = 'user-123';

  it('admin puede anular pedidos pendientes o en preparación', () => {
    expect(canCancel('admin', { status: 'pendiente' })).toBe(true);
    expect(canCancel('admin', { status: 'en_preparacion' })).toBe(true);
    expect(canCancel('admin', { status: 'listo' })).toBe(false);
    expect(canCancel('admin', { status: 'entregado' })).toBe(false);
    expect(canCancel('admin', { status: 'anulado' })).toBe(false);
  });

  it('cajero solo puede anular si es suyo y del mismo día', () => {
    expect(
      canCancel(
        'cajero',
        { status: 'pendiente', cashierId: myId, businessDate: today },
        myId,
        today,
      ),
    ).toBe(true);

    expect(
      canCancel(
        'cajero',
        { status: 'en_preparacion', cashierId: myId, businessDate: today },
        myId,
        today,
      ),
    ).toBe(true);

    // De otro cajero
    expect(
      canCancel(
        'cajero',
        { status: 'pendiente', cashierId: 'other-user', businessDate: today },
        myId,
        today,
      ),
    ).toBe(false);

    // De otro día
    expect(
      canCancel(
        'cajero',
        { status: 'pendiente', cashierId: myId, businessDate: '2026-11-21' },
        myId,
        today,
      ),
    ).toBe(false);

    // Si ya está listo o entregado
    expect(
      canCancel(
        'cajero',
        { status: 'listo', cashierId: myId, businessDate: today },
        myId,
        today,
      ),
    ).toBe(false);
  });
});
