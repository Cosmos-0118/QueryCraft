import { sql } from '@/lib/test-db';

export interface UpdateDraftTestInput {
  title?: string;
  description?: string;
  status?: string;
}

export async function updateDraftTest(id: string, input: UpdateDraftTestInput) {
  // Only allow updating title, description, or status for draft tests
  const fields = [];
  const values = [];
  let idx = 1;
  if (input.title !== undefined) {
    fields.push(`title = $${idx++}`);
    values.push(input.title);
  }
  if (input.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(input.description);
  }
  if (input.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(input.status);
  }
  if (fields.length === 0) return null;
  values.push(id);
  // Build the SQL query dynamically but use sql[] for parameterization
  const setClause = fields.join(', ');
  const query = [
    `UPDATE tests SET ${setClause}, updated_at = now() WHERE id = $${idx} AND status = 'draft' RETURNING *;`
  ];
  // Use the sql tag with .raw for dynamic query
  const result = await sql.raw(query[0], values);
  return result.rows[0] || null;
}
