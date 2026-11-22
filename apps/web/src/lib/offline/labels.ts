/** Número provisional de un pedido aún no sincronizado (SPEC-offline-print OP-D11). */
export function provisionalOrderLabel(clientOrderId: string): string {
  return `OFF-${clientOrderId.replace(/-/g, '').slice(-4).toUpperCase()}`;
}
