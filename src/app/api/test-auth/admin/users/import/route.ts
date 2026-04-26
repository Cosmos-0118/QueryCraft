import { NextRequest, NextResponse } from 'next/server';
import { bulkUpsertAccounts, type TestAccountRole } from '@/lib/test-auth/accounts-db';
import { parseCsv, parseXlsx } from '@/lib/test-auth/import-parser';
import { requireAdminSession } from '@/lib/test-auth/session';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

function isValidRole(value: unknown): value is TestAccountRole {
  return value === 'teacher' || value === 'student';
}

export async function POST(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const defaultRoleRaw = formData.get('default_role');
    const defaultRole: TestAccountRole = isValidRole(defaultRoleRaw) ? defaultRoleRaw : 'student';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A CSV or XLSX file is required.' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Uploaded file is too large (max 5 MB).' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = (file.name || '').toLowerCase();
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const parsed = isXlsx
      ? await parseXlsx(buffer, defaultRole)
      : parseCsv(buffer.toString('utf8'), defaultRole);

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid rows were found in the file.',
          rejected: parsed.rejected,
        },
        { status: 400 },
      );
    }

    const summary = await bulkUpsertAccounts(parsed.rows);

    return NextResponse.json({
      summary,
      rejected: parsed.rejected,
      default_role: defaultRole,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to import accounts.' },
      { status: 500 },
    );
  }
}
