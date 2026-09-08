export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
