export { updateDraftTest } from './update-draft-test';
import { sql } from '@/lib/test-db';

export interface CreateDraftTestInput {
  title: string;
  description?: string;
  created_by: string;
  question_mode: string;
  mix_mcq_percent?: number | null;
  mix_sql_fill_percent?: number | null;
  duration_minutes: number;
  anti_cheat_policy: object;
  status?: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

export async function createDraftTest(input: CreateDraftTestInput) {
  const result = await sql`
    INSERT INTO tests (
      title, description, created_by, question_mode, mix_mcq_percent, mix_sql_fill_percent, duration_minutes, anti_cheat_policy, status, starts_at, ends_at
    ) VALUES (
      ${input.title},
      ${input.description ?? ''},
      ${input.created_by},
      ${input.question_mode},
      ${input.mix_mcq_percent ?? null},
      ${input.mix_sql_fill_percent ?? null},
      ${input.duration_minutes},
      ${JSON.stringify(input.anti_cheat_policy)},
      ${input.status ?? 'draft'},
      ${input.starts_at ?? null},
      ${input.ends_at ?? null}
    )
    RETURNING *;
  `;
  return result.rows[0];
}

export async function publishTest(id: string) {
  // Only allow publishing if status is 'draft'
  const result = await sql`
    UPDATE tests
    SET status = 'published', published_at = now(), updated_at = now()
    WHERE id = ${id} AND status = 'draft'
    RETURNING *;
  `;
  return result.rows[0] || null;
}
