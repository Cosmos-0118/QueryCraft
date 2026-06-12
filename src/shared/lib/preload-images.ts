export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.decoding = 'async';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

export async function preloadImages(
  sources: string[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  if (sources.length === 0) {
    onProgress?.(0, 0);
    return;
  }

  let loaded = 0;
  await Promise.all(
    sources.map(async (src) => {
      await preloadImage(src);
      loaded += 1;
      onProgress?.(loaded, sources.length);
    }),
  );
}
