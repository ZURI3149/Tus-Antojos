/** Tiempo transcurrido desde que se creó la comanda; >= 15 min se marca como demorada. */
export function formatElapsed(createdAt: string): { label: string; isDelayed: boolean } {
  const created = new Date(createdAt).getTime();
  const diffMinutes = Math.floor((Date.now() - created) / 60_000);
  if (Number.isNaN(diffMinutes) || diffMinutes < 1) {
    return { label: 'Ahora mismo', isDelayed: false };
  }
  return {
    label: `Hace ${diffMinutes} min`,
    isDelayed: diffMinutes >= 15,
  };
}
