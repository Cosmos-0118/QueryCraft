import { sql } from '@/lib/test-db';
import { hashPassword } from '@/lib/test-auth/crypto';
import { deriveDisplayName } from '@/lib/test-auth/admin-env';

export type TestAccountRole = 'teacher' | 'student';

export interface TestAccountRecord {
  id: string;
  email: string;
  role: TestAccountRole;
  display_name: string;
  password_set: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AccountWithSecretRow {
  id: string;
  email: string;
  role: TestAccountRole;
  display_name: string | null;
  password_hash: string | null;
  password_set: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PublicAccountRow {
  id: string;
  email: string;
  role: TestAccountRole;
  display_name: string | null;
  password_set: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapPublic(row: PublicAccountRow | AccountWithSecretRow): TestAccountRecord {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    display_name: row.display_name ?? deriveDisplayName(row.email),
    password_set: !!row.password_set,
    is_active: !!row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const PUBLIC_COLUMNS = `
  id,
  email,
  role,
  display_name,
  password_set,
  is_active,
  created_at,
  updated_at
`;

const SECRET_COLUMNS = `
  id,
  email,
  role,
  display_name,
  password_hash,
  password_set,
  is_active,
  created_at,
  updated_at
`;

function normalizeEmail(email: string): { email: string; emailLower: string } {
  const trimmed = email.trim();
  return { email: trimmed, emailLower: trimmed.toLowerCase() };
}

export async function findAccountByEmailWithSecret(email: string) {
  const { emailLower } = normalizeEmail(email);

  const result = await sql.raw(
    `
    SELECT ${SECRET_COLUMNS}
    FROM test_module_accounts
    WHERE email_lower = $1
    LIMIT 1;
    `,
    [emailLower],
  );

  return (result.rows[0] as AccountWithSecretRow | undefined) ?? null;
}

export async function findAccountByEmail(email: string): Promise<TestAccountRecord | null> {
  const { emailLower } = normalizeEmail(email);

  const result = await sql.raw(
    `
    SELECT ${PUBLIC_COLUMNS}
    FROM test_module_accounts
    WHERE email_lower = $1
    LIMIT 1;
    `,
    [emailLower],
  );

  const row = result.rows[0] as PublicAccountRow | undefined;
  return row ? mapPublic(row) : null;
}

export async function findAccountById(id: string): Promise<TestAccountRecord | null> {
  const result = await sql.raw(
    `
    SELECT ${PUBLIC_COLUMNS}
    FROM test_module_accounts
    WHERE id = $1
    LIMIT 1;
    `,
    [id],
  );

  const row = result.rows[0] as PublicAccountRow | undefined;
  return row ? mapPublic(row) : null;
}

export async function listAccounts(): Promise<TestAccountRecord[]> {
  const result = await sql.raw(
    `
    SELECT ${PUBLIC_COLUMNS}
    FROM test_module_accounts
    ORDER BY created_at DESC;
    `,
    [],
  );

  return (result.rows as PublicAccountRow[]).map(mapPublic);
}

export interface CreateAccountInput {
  email: string;
  role: TestAccountRole;
  displayName?: string;
}

export interface CreateAccountOutcome {
  account: TestAccountRecord;
  created: boolean;
}

export async function createAccount(input: CreateAccountInput): Promise<CreateAccountOutcome> {
  const { email, emailLower } = normalizeEmail(input.email);
  if (!email || !emailLower.includes('@')) {
    throw new Error('A valid email is required.');
  }

  const displayName = input.displayName?.trim() || deriveDisplayName(email);

  const result = await sql.raw(
    `
    INSERT INTO test_module_accounts (email, email_lower, role, display_name)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email_lower) DO NOTHING
    RETURNING ${PUBLIC_COLUMNS};
    `,
    [email, emailLower, input.role, displayName],
  );

  const inserted = result.rows[0] as PublicAccountRow | undefined;
  if (inserted) {
    return { account: mapPublic(inserted), created: true };
  }

  const existing = await findAccountByEmail(email);
  if (!existing) {
    throw new Error('Failed to create account.');
  }

  return { account: existing, created: false };
}

export interface UpdateAccountInput {
  role?: TestAccountRole;
  displayName?: string;
  isActive?: boolean;
}

export async function updateAccountById(id: string, input: UpdateAccountInput): Promise<TestAccountRecord | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (input.role !== undefined) {
    sets.push(`role = $${i++}`);
    values.push(input.role);
  }

  if (input.displayName !== undefined) {
    sets.push(`display_name = $${i++}`);
    values.push(input.displayName.trim());
  }

  if (input.isActive !== undefined) {
    sets.push(`is_active = $${i++}`);
    values.push(input.isActive);
  }

  if (sets.length === 0) {
    return findAccountById(id);
  }

  sets.push(`updated_at = now()`);
  values.push(id);

  const result = await sql.raw(
    `
    UPDATE test_module_accounts
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING ${PUBLIC_COLUMNS};
    `,
    values,
  );

  const row = result.rows[0] as PublicAccountRow | undefined;
  return row ? mapPublic(row) : null;
}

export async function deleteAccountById(id: string): Promise<boolean> {
  const result = await sql.raw(
    `
    DELETE FROM test_module_accounts
    WHERE id = $1;
    `,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function setAccountPasswordHash(id: string, passwordHash: string): Promise<TestAccountRecord | null> {
  const result = await sql.raw(
    `
    UPDATE test_module_accounts
    SET password_hash = $1,
        password_set = true,
        updated_at = now()
    WHERE id = $2
    RETURNING ${PUBLIC_COLUMNS};
    `,
    [passwordHash, id],
  );

  const row = result.rows[0] as PublicAccountRow | undefined;
  return row ? mapPublic(row) : null;
}

export async function setInitialPasswordForEmail(email: string, password: string): Promise<TestAccountRecord | null> {
  const account = await findAccountByEmailWithSecret(email);
  if (!account) return null;
  if (account.password_set) {
    throw new Error('A password is already set for this account.');
  }
  if (!account.is_active) {
    throw new Error('This account has been disabled. Contact the administrator.');
  }

  const passwordHash = await hashPassword(password);
  return setAccountPasswordHash(account.id, passwordHash);
}

export interface BulkUpsertResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ email: string; reason: string }>;
}

export async function bulkUpsertAccounts(rows: Array<{ email: string; role: TestAccountRole }>): Promise<BulkUpsertResult> {
  const summary: BulkUpsertResult = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      const outcome = await createAccount({ email: row.email, role: row.role });
      if (outcome.created) {
        summary.created += 1;
        continue;
      }

      // Existing account; update its role (but never silently flip an admin-imported
      // teacher to student or vice versa — only update when role differs).
      if (outcome.account.role !== row.role) {
        await updateAccountById(outcome.account.id, { role: row.role });
        summary.updated += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.errors.push({
        email: row.email,
        reason: error instanceof Error ? error.message : 'Unknown error.',
      });
    }
  }

  return summary;
}
