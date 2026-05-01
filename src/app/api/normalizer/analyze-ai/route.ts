import { NextRequest, NextResponse } from 'next/server';
import type {
  FunctionalDependency,
  JoinDependency,
  MultivaluedDependency,
} from '@/types/normalizer';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant';
const GROQ_FALLBACK_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
];

type AiConfidence = 'low' | 'medium' | 'high';

interface SanitizedInputTable {
  tableId: string;
  name: string;
  columns: string[];
  primaryKey: string[];
  fds: FunctionalDependency[];
  mvds: MultivaluedDependency[];
  joinDependencies: JoinDependency[];
  sampleData: string[][];
}

interface SanitizedWorkflowStage {
  stage: string;
  tables: SanitizedInputTable[];
}

interface AiSuggestionPayload {
  summary: string;
  confidence: AiConfidence;
  functionalDependencies: FunctionalDependency[];
  multivaluedDependencies: MultivaluedDependency[];
  joinDependencies: JoinDependency[];
  notes: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUniqueStrings(value: unknown, max = 80): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    const text = cleanString(entry);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function sanitizeFunctionalDependency(
  value: unknown,
  validColumns: Set<string>,
): FunctionalDependency | null {
  if (!isRecord(value)) return null;
  const determinant = normalizeUniqueStrings(value.determinant).filter((item) => validColumns.has(item));
  const dependent = normalizeUniqueStrings(value.dependent)
    .filter((item) => validColumns.has(item) && !determinant.includes(item));
  if (determinant.length === 0 || dependent.length === 0) return null;
  return { determinant, dependent };
}

function sanitizeMultivaluedDependency(
  value: unknown,
  validColumns: Set<string>,
): MultivaluedDependency | null {
  if (!isRecord(value)) return null;
  const determinant = normalizeUniqueStrings(value.determinant).filter((item) => validColumns.has(item));
  const dependent = normalizeUniqueStrings(value.dependent)
    .filter((item) => validColumns.has(item) && !determinant.includes(item));
  if (determinant.length === 0 || dependent.length === 0) return null;
  return { determinant, dependent };
}

function sanitizeJoinDependency(
  value: unknown,
  validColumns: Set<string>,
): JoinDependency | null {
  if (!isRecord(value) || !Array.isArray(value.components)) return null;
  const components: string[][] = [];
  for (const component of value.components) {
    const normalized = normalizeUniqueStrings(component).filter((item) => validColumns.has(item));
    if (normalized.length > 0) components.push(normalized);
  }
  if (components.length < 2) return null;
  return { components };
}

function sanitizeInputTable(value: unknown): SanitizedInputTable | null {
  if (!isRecord(value)) return null;
  const tableId = cleanString(value.tableId) ?? cleanString(value.id) ?? null;
  const name = cleanString(value.name) ?? 'Table';
  if (!tableId) return null;

  const rawColumns = Array.isArray(value.columns) ? value.columns : [];
  const columns: string[] = [];
  const seenColumns = new Set<string>();
  for (const rawColumn of rawColumns) {
    const nextName = typeof rawColumn === 'string'
      ? cleanString(rawColumn)
      : isRecord(rawColumn)
        ? cleanString(rawColumn.name)
        : null;
    if (!nextName || seenColumns.has(nextName)) continue;
    seenColumns.add(nextName);
    columns.push(nextName);
  }
  if (columns.length === 0) return null;
  const validColumns = new Set(columns);

  const primaryKey = normalizeUniqueStrings(value.primaryKey).filter((item) => validColumns.has(item));
  const fds = (Array.isArray(value.fds) ? value.fds : [])
    .map((fd) => sanitizeFunctionalDependency(fd, validColumns))
    .filter((fd): fd is FunctionalDependency => fd !== null);
  const mvds = (Array.isArray(value.mvds) ? value.mvds : [])
    .map((mvd) => sanitizeMultivaluedDependency(mvd, validColumns))
    .filter((mvd): mvd is MultivaluedDependency => mvd !== null);
  const joinDependencies = (Array.isArray(value.joinDependencies) ? value.joinDependencies : [])
    .map((jd) => sanitizeJoinDependency(jd, validColumns))
    .filter((jd): jd is JoinDependency => jd !== null);

  const sampleData: string[][] = [];
  if (Array.isArray(value.sampleData)) {
    const maxRows = 120;
    const maxCellLength = 500;
    for (const row of value.sampleData) {
      if (!Array.isArray(row)) continue;
      const normalized = Array.from({ length: columns.length }, (_, index) => {
        const cell = row[index];
        if (cell === null || cell === undefined) return '';
        return String(cell).slice(0, maxCellLength);
      });
      if (normalized.some((cell) => cell.trim().length > 0)) {
        sampleData.push(normalized);
      }
      if (sampleData.length >= maxRows) break;
    }
  }

  return {
    tableId,
    name,
    columns,
    primaryKey,
    fds,
    mvds,
    joinDependencies,
    sampleData,
  };
}

function parseAiConfidence(value: unknown): AiConfidence {
  const normalized = cleanString(value)?.toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  return 'medium';
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    try {
      return JSON.parse(fencedMatch[1]);
    } catch {
      // fall through
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstCurly = trimmed.indexOf('{');
    const lastCurly = trimmed.lastIndexOf('}');
    if (firstCurly >= 0 && lastCurly > firstCurly) {
      const candidate = trimmed.slice(firstCurly, lastCurly + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function sanitizeAiSuggestionPayload(
  value: unknown,
  validColumns: Set<string>,
): AiSuggestionPayload | null {
  if (!isRecord(value)) return null;
  const summary = cleanString(value.summary) ?? 'AI analysis completed.';
  const notes = normalizeUniqueStrings(value.notes, 12);
  const functionalDependencies = (Array.isArray(value.functionalDependencies) ? value.functionalDependencies : [])
    .map((fd) => sanitizeFunctionalDependency(fd, validColumns))
    .filter((fd): fd is FunctionalDependency => fd !== null);
  const multivaluedDependencies = (Array.isArray(value.multivaluedDependencies) ? value.multivaluedDependencies : [])
    .map((mvd) => sanitizeMultivaluedDependency(mvd, validColumns))
    .filter((mvd): mvd is MultivaluedDependency => mvd !== null);
  const joinDependencies = (Array.isArray(value.joinDependencies) ? value.joinDependencies : [])
    .map((jd) => sanitizeJoinDependency(jd, validColumns))
    .filter((jd): jd is JoinDependency => jd !== null);

  return {
    summary,
    confidence: parseAiConfidence(value.confidence),
    functionalDependencies,
    multivaluedDependencies,
    joinDependencies,
    notes,
  };
}

function sanitizeWorkflow(value: unknown): SanitizedWorkflowStage[] {
  if (!Array.isArray(value)) return [];
  const stages: SanitizedWorkflowStage[] = [];
  for (const stageValue of value) {
    if (!isRecord(stageValue)) continue;
    const stage = cleanString(stageValue.stage);
    if (!stage) continue;
    const tables = (Array.isArray(stageValue.tables) ? stageValue.tables : [])
      .map((table) => sanitizeInputTable(table))
      .filter((table): table is SanitizedInputTable => table !== null);
    if (tables.length === 0) continue;
    stages.push({ stage, tables });
  }
  return stages;
}

function createBulkPrompt(workflow: SanitizedWorkflowStage[]): string {
  return [
    'You are a strict database normalization assistant.',
    'Analyze the full normalization workflow context across phases (UNF..5NF).',
    'Infer likely FDs, MVDs, and JDs for each table using both per-table data and cross-phase context.',
    'Use ONLY the provided column names and tableIds exactly as-is.',
    'Return one JSON object in this exact shape:',
    '{',
    '  "summary": string,',
    '  "notes": string[],',
    '  "stages": [',
    '    {',
    '      "stage": string,',
    '      "tables": [',
    '        {',
    '          "tableId": string,',
    '          "summary": string,',
    '          "confidence": "low" | "medium" | "high",',
    '          "functionalDependencies": [{ "determinant": string[], "dependent": string[] }],',
    '          "multivaluedDependencies": [{ "determinant": string[], "dependent": string[] }],',
    '          "joinDependencies": [{ "components": string[][] }],',
    '          "notes": string[]',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
    'Rules:',
    '- Keep suggestions conservative when evidence is weak.',
    '- Keep dependencies non-trivial.',
    '- If no reliable dependencies for a table section, return an empty array.',
    '- Always include tableId so suggestions map exactly.',
    '',
    'Workflow context:',
    JSON.stringify(workflow, null, 2),
  ].join('\n');
}

async function callGroqWithFallback(args: {
  apiKey: string;
  modelCandidates: string[];
  prompt: string;
}): Promise<{ payload: { choices?: Array<{ message?: { content?: unknown } }> } | null; selectedModel: string }> {
  const { apiKey, modelCandidates, prompt } = args;
  let lastError = '';

  for (const candidateModel of modelCandidates) {
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: candidateModel,
        temperature: 0.1,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: 'You analyze relation schemas and return strict JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (groqResponse.ok) {
      const payload = await groqResponse.json().catch(() => null) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      } | null;
      return { payload, selectedModel: candidateModel };
    }

    const errorText = await groqResponse.text();
    lastError = `Groq request failed (${groqResponse.status}): ${errorText.slice(0, 600)}`;
    const isDecommissioned = /decommissioned|model_decommissioned/i.test(errorText);
    if (!isDecommissioned) {
      throw new Error(lastError);
    }
  }

  throw new Error(lastError || 'Groq request failed for all model candidates.');
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing GROQ_API_KEY. Add it to your environment before using AI analysis.' },
      { status: 500 },
    );
  }

  try {
    const body = await req.json().catch(() => null) as {
      model?: unknown;
      workflow?: unknown;
      stage?: unknown;
      table?: unknown;
    } | null;

    const requestedModel = cleanString(body?.model) ?? DEFAULT_GROQ_MODEL;
    const modelCandidates = [
      requestedModel,
      ...GROQ_FALLBACK_MODELS.filter((candidate) => candidate !== requestedModel),
    ];

    const workflow = sanitizeWorkflow(body?.workflow);
    if (workflow.length > 0) {
      const prompt = createBulkPrompt(workflow);
      const { payload, selectedModel } = await callGroqWithFallback({
        apiKey,
        modelCandidates,
        prompt,
      });

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        return NextResponse.json({ error: 'Groq returned an empty response.' }, { status: 502 });
      }

      const rawJson = extractJsonObject(content);
      if (!isRecord(rawJson) || !Array.isArray(rawJson.stages)) {
        return NextResponse.json({ error: 'Could not parse AI output into stage suggestions.' }, { status: 502 });
      }

      const stageByName = new Map(workflow.map((stage) => [stage.stage, stage]));
      const outputStages: Array<{
        stage: string;
        tables: Array<{ tableId: string; suggestions: AiSuggestionPayload }>;
      }> = [];

      for (const rawStage of rawJson.stages) {
        if (!isRecord(rawStage)) continue;
        const stageName = cleanString(rawStage.stage);
        if (!stageName) continue;
        const sourceStage = stageByName.get(stageName);
        if (!sourceStage) continue;

        const sourceTableById = new Map(sourceStage.tables.map((table) => [table.tableId, table]));
        const rawTables = Array.isArray(rawStage.tables) ? rawStage.tables : [];
        const tables: Array<{ tableId: string; suggestions: AiSuggestionPayload }> = [];

        for (const rawTable of rawTables) {
          if (!isRecord(rawTable)) continue;
          const tableId = cleanString(rawTable.tableId);
          if (!tableId) continue;
          const sourceTable = sourceTableById.get(tableId);
          if (!sourceTable) continue;

          const suggestions = sanitizeAiSuggestionPayload(rawTable, new Set(sourceTable.columns));
          if (!suggestions) continue;
          tables.push({ tableId, suggestions });
        }

        if (tables.length > 0) {
          outputStages.push({ stage: stageName, tables });
        }
      }

      return NextResponse.json({
        mode: 'bulk',
        model: selectedModel,
        summary: cleanString(rawJson.summary) ?? 'AI analysis completed.',
        notes: normalizeUniqueStrings(rawJson.notes, 20),
        stages: outputStages,
      });
    }

    // Backward-compatible single-table mode
    const stage = cleanString(body?.stage) ?? 'UNF';
    const table = sanitizeInputTable(body?.table);
    if (!table) {
      return NextResponse.json({ error: 'A valid table payload is required.' }, { status: 400 });
    }

    const prompt = createBulkPrompt([{ stage, tables: [table] }]);
    const { payload, selectedModel } = await callGroqWithFallback({
      apiKey,
      modelCandidates,
      prompt,
    });
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Groq returned an empty response.' }, { status: 502 });
    }
    const rawJson = extractJsonObject(content);
    const rawSingleStage = isRecord(rawJson) && Array.isArray(rawJson.stages)
      ? rawJson.stages.find((entry) => isRecord(entry) && cleanString(entry.stage) === stage)
      : null;
    const rawSingleTable = isRecord(rawSingleStage) && Array.isArray(rawSingleStage.tables)
      ? rawSingleStage.tables.find((entry) => isRecord(entry) && cleanString(entry.tableId) === table.tableId)
      : null;
    const suggestions = sanitizeAiSuggestionPayload(rawSingleTable, new Set(table.columns));
    if (!suggestions) {
      return NextResponse.json({ error: 'Could not parse AI output into valid dependency suggestions.' }, { status: 502 });
    }

    return NextResponse.json({
      mode: 'single',
      model: selectedModel,
      stage,
      suggestions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI analysis failed.' },
      { status: 500 },
    );
  }
}
