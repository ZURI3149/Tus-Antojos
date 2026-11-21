import { describe, expect, it } from 'vitest';
import { computeStockTotalValue, formatUnitCost, stockStatus } from './stock';

describe('stockStatus', () => {
  it('identifica stock negativo antes que bajo mínimo', () => {
    expect(stockStatus(-1, 0)).toBe('negativo');
    expect(stockStatus(-1, 500)).toBe('negativo');
    expect(stockStatus(-50, 100)).toBe('negativo');
  });

  it('identifica stock bajo mínimo', () => {
    expect(stockStatus(400, 500)).toBe('bajo_minimo');
    expect(stockStatus(0, 100)).toBe('bajo_minimo');
    expect(stockStatus(1, 2)).toBe('bajo_minimo');
  });

  it('identifica stock normal', () => {
    expect(stockStatus(400, 0)).toBe('normal');
    expect(stockStatus(500, 500)).toBe('normal');
    expect(stockStatus(600, 500)).toBe('normal');
    expect(stockStatus(0, 0)).toBe('normal');
  });
});

describe('formatUnitCost', () => {
  it('formatea correctamente los casos del spec y criterios de aceptación', () => {
    expect(formatUnitCost('0.800000', 'g')).toBe('Bs 8,00 / kg');
    expect(formatUnitCost('150', 'unidad')).toBe('Bs 1,50 / unidad');
  });

  it('formatea costos para ml expresados por litro (L)', () => {
    expect(formatUnitCost('1.250000', 'ml')).toBe('Bs 12,50 / L');
    expect(formatUnitCost('0.005000', 'ml')).toBe('Bs 0,05 / L');
  });

  it('maneja valores 0 sin error', () => {
    expect(formatUnitCost('0', 'g')).toBe('Bs 0,00 / kg');
    expect(formatUnitCost('0.000000', 'ml')).toBe('Bs 0,00 / L');
    expect(formatUnitCost(0, 'unidad')).toBe('Bs 0,00 / unidad');
  });

  it('soporta números además de strings', () => {
    expect(formatUnitCost(0.8, 'g')).toBe('Bs 8,00 / kg');
    expect(formatUnitCost(150, 'unidad')).toBe('Bs 1,50 / unidad');
  });
});

describe('computeStockTotalValue', () => {
  it('calcula el total en centavos para stock positivo', () => {
    // 1000 g a 0.8 centavos/g = 800 centavos
    expect(computeStockTotalValue(1000, '0.800000')).toBe(800);
    // 500 ml a 0.5 centavos/ml = 250 centavos
    expect(computeStockTotalValue(500, 0.5)).toBe(250);
  });

  it('devuelve 0 si la cantidad es cero o negativa', () => {
    expect(computeStockTotalValue(0, '0.800000')).toBe(0);
    expect(computeStockTotalValue(-500, '0.800000')).toBe(0);
  });

  it('devuelve 0 si el costo es cero o inválido', () => {
    expect(computeStockTotalValue(1000, '0.000000')).toBe(0);
    expect(computeStockTotalValue(1000, 'invalid')).toBe(0);
  });
});
