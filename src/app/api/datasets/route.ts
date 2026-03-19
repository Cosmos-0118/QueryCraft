import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

interface DatasetPayload {
  name: string;
  data: Record<string, unknown>;
}

export async function GET() {
  const datasetsDir = path.join(process.cwd(), 'seed', 'datasets');

  try {
    const entries = await fs.readdir(datasetsDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const datasets: DatasetPayload[] = [];

    for (const fileName of jsonFiles) {
      const filePath = path.join(datasetsDir, fileName);
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        continue;
      }

      datasets.push({
        name: path.basename(fileName, '.json').toLowerCase(),
        data: parsed as Record<string, unknown>,
      });
    }

    return NextResponse.json({ datasets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read datasets';
    return NextResponse.json({ error: message, datasets: [] }, { status: 500 });
  }
}