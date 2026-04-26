import readXlsxFile from 'read-excel-file/node';
import type { TestAccountRole } from '@/lib/test-auth/accounts-db';

export interface ImportRow {
  email: string;
  role: TestAccountRole;
}

export interface ImportParseResult {
  rows: ImportRow[];
  /** Rows that we received but that failed validation (bad email/role). */
  rejected: Array<{ rawEmail: string; rawRole: string; reason: string }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeRoleCell(value: string, defaultRole: TestAccountRole): TestAccountRole | null {
  const lower = value.trim().toLowerCase();
  if (!lower) return defaultRole;
  if (lower === 'teacher' || lower === 'faculty' || lower === 'instructor') return 'teacher';
  if (lower === 'student') return 'student';
  return null;
}

function looksLikeHeader(emailCell: string, roleCell: string): boolean {
  const email = emailCell.toLowerCase();
  const role = roleCell.toLowerCase();
  return (
    (email === 'email' || email === 'email_address' || email === 'mail') &&
    (role === '' || role === 'role' || role === 'type')
  );
}

function buildRow(
  emailCell: string,
  roleCell: string,
  defaultRole: TestAccountRole,
): { row?: ImportRow; reason?: string } {
  const email = emailCell.trim();
  if (!email) return { reason: 'Empty email cell.' };
  if (!EMAIL_RE.test(email)) return { reason: 'Invalid email format.' };

  const role = normalizeRoleCell(roleCell, defaultRole);
  if (!role) return { reason: `Unknown role "${roleCell}".` };

  return { row: { email, role } };
}

export function parseCsv(text: string, defaultRole: TestAccountRole): ImportParseResult {
  const result: ImportParseResult = { rows: [], rejected: [] };

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return result;

  let startIndex = 0;
  const firstCells = lines[0].split(',').map((cell) => cell.trim());
  if (looksLikeHeader(firstCells[0] ?? '', firstCells[1] ?? '')) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const cells = lines[i].split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const emailCell = cells[0] ?? '';
    const roleCell = cells[1] ?? '';

    const { row, reason } = buildRow(emailCell, roleCell, defaultRole);
    if (row) {
      result.rows.push(row);
    } else if (reason) {
      result.rejected.push({ rawEmail: emailCell, rawRole: roleCell, reason });
    }
  }

  return result;
}

export async function parseXlsx(buffer: Buffer, defaultRole: TestAccountRole): Promise<ImportParseResult> {
  const result: ImportParseResult = { rows: [], rejected: [] };

  const sheet = (await readXlsxFile(buffer)) as unknown as unknown[][];
  if (!Array.isArray(sheet) || sheet.length === 0) return result;

  let startIndex = 0;
  const first = (sheet[0] ?? []) as unknown[];
  const firstEmail = String(first[0] ?? '').trim();
  const firstRole = String(first[1] ?? '').trim();
  if (looksLikeHeader(firstEmail, firstRole)) {
    startIndex = 1;
  }

  for (let i = startIndex; i < sheet.length; i++) {
    const rowCells = (sheet[i] ?? []) as unknown[];
    const emailCell = String(rowCells[0] ?? '').trim();
    const roleCell = String(rowCells[1] ?? '').trim();

    const { row, reason } = buildRow(emailCell, roleCell, defaultRole);
    if (row) {
      result.rows.push(row);
    } else if (reason) {
      result.rejected.push({ rawEmail: emailCell, rawRole: roleCell, reason });
    }
  }

  return result;
}
