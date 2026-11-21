import { describe, expect, it } from 'vitest';
import { INVENTORY_RULE_MESSAGES, INVENTORY_RULES, inventoryRuleMessage } from './rules';

describe('inventoryRules', () => {
  it('define mensajes en español para todas las reglas requeridas', () => {
    for (const rule of INVENTORY_RULES) {
      expect(INVENTORY_RULE_MESSAGES[rule]).toBeDefined();
      expect(typeof INVENTORY_RULE_MESSAGES[rule]).toBe('string');
      expect(INVENTORY_RULE_MESSAGES[rule].length).toBeGreaterThan(10);
    }
  });

  it('contiene las reglas requeridas por el spec', () => {
    expect(inventoryRuleMessage('STOCK_INSUFFICIENT')).toBe(
      'No hay suficiente stock disponible para registrar la salida',
    );
    expect(inventoryRuleMessage('ADJUSTMENT_NO_CHANGE')).toBe(
      'La cantidad contada es igual al stock actual',
    );
    expect(inventoryRuleMessage('INGREDIENT_NOT_FOUND')).toBe('El insumo no existe');
    expect(inventoryRuleMessage('KARDEX_APPEND_ONLY')).toBe(
      'Los movimientos del kardex no se pueden modificar ni eliminar',
    );
    expect(inventoryRuleMessage('INGREDIENT_INACTIVE')).toBe('El insumo está inactivo');
    expect(inventoryRuleMessage('INGREDIENT_UNIT_LOCKED')).toBe(
      'No se puede cambiar la unidad de un insumo que ya tiene movimientos en el kardex',
    );
  });

  it('devuelve undefined para códigos no reconocidos', () => {
    expect(inventoryRuleMessage('UNKNOWN_RULE')).toBeUndefined();
  });
});
