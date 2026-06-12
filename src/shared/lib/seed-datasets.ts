export interface SeedDataset {
  name: string;
  data: Record<string, unknown>;
}

interface SeedDatasetsResponse {
  datasets?: SeedDataset[];
}

export async function fetchSeedDatasets(signal?: AbortSignal): Promise<SeedDataset[]> {
  const response = await fetch('/api/datasets', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as SeedDatasetsResponse;
  if (!payload.datasets || !Array.isArray(payload.datasets)) return [];

  return payload.datasets.filter((dataset) => {
    if (!dataset || typeof dataset.name !== 'string' || !dataset.name.trim()) return false;
    if (!dataset.data || typeof dataset.data !== 'object' || Array.isArray(dataset.data)) return false;
    return true;
  });
}