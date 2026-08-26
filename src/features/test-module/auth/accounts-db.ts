import { sql } from '@/features/test-module/db';
import { hashPassword } from '@/features/test-module/auth/crypto';
import { deriveDisplayName } from '@/features/test-module/auth/admin-env';

export type TestAccountRole = 'admin' | 'teacher' | 'student';

export interface TestAccountRecord {
  id: string;
  email: string;
  role: TestAccountRole;
  display_name: string;
  faculty_id: string | null;
  registration_number: string | null;
  section: string | null;
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
  faculty_id: string | null;
  registration_number: string | null;
  section: string | null;
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
  faculty_id: string | null;
  registration_number: string | null;
  section: string | null;
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
    faculty_id: row.faculty_id ?? null,
    registration_number: row.registration_number ?? null,
    section: row.section ?? null,
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
  faculty_id,
  registration_number,
  section,
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
  faculty_id,
  registration_number,
  section,
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

let authSchemaReadyPromise: Promise<void> | null = null;

export function ensureAuthSchemaExtensions(): Promise<void> {
  authSchemaReadyPromise ??= sql.raw(
    `
    ALTER TABLE test_module_accounts
      ADD COLUMN IF NOT EXISTS faculty_id text,
      ADD COLUMN IF NOT EXISTS registration_number text,
      ADD COLUMN IF NOT EXISTS section text;

    ALTER TABLE test_module_accounts
      DROP CONSTRAINT IF EXISTS test_module_accounts_role_check;

    ALTER TABLE test_module_accounts
      ADD CONSTRAINT test_module_accounts_role_check
      CHECK (role IN ('admin', 'teacher', 'student'));

    CREATE TABLE IF NOT EXISTS test_auth_otps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email_lower text NOT NULL,
      otp_hash text NOT NULL,
      purpose text NOT NULL CHECK (purpose IN ('setup_password')),
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_test_auth_otps_email_purpose
      ON test_auth_otps (email_lower, purpose, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_test_auth_otps_expires_at
      ON test_auth_otps (expires_at);
    `,
    [],
  ).then(() => undefined);

  return authSchemaReadyPromise;
}

export async function findAccountByEmailWithSecret(email: string) {
  await ensureAuthSchemaExtensions();
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
  await ensureAuthSchemaExtensions();
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
  await ensureAuthSchemaExtensions();
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
  await ensureAuthSchemaExtensions();
  const result = await sql.raw(
    `
    SELECT ${PUBLIC_COLUMNS}
    FROM test_module_accounts
    WHERE role <> 'admin'
    ORDER BY created_at DESC;
    `,
    [],
  );

  return (result.rows as PublicAccountRow[]).map(mapPublic);
}

export async function ensureAdminAccount(email: string): Promise<TestAccountRecord> {
  const existing = await findAccountByEmail(email);
  if (existing) {
    if (existing.role !== 'admin') {
      const updated = await updateAccountById(existing.id, { role: 'admin', isActive: true });
      if (!updated) {
        throw new Error('Unable to activate admin account.');
      }
      return updated;
    }

    return existing;
  }

  const outcome = await createAccount({
    email,
    role: 'admin',
    displayName: deriveDisplayName(email),
  });
  return outcome.account;
}

export interface CreateAccountInput {
  email: string;
  role: TestAccountRole;
  displayName?: string;
  facultyId?: string | null;
  registrationNumber?: string | null;
  section?: string | null;
}

export interface CreateAccountOutcome {
  account: TestAccountRecord;
  created: boolean;
}

export async function createAccount(input: CreateAccountInput): Promise<CreateAccountOutcome> {
  await ensureAuthSchemaExtensions();
  const { email, emailLower } = normalizeEmail(input.email);
  if (!email || !emailLower.includes('@')) {
    throw new Error('A valid email is required.');
  }

  const displayName = input.displayName?.trim() || deriveDisplayName(email);

  const result = await sql.raw(
    `
    INSERT INTO test_module_accounts (
      email,
      email_lower,
      role,
      display_name,
      faculty_id,
      registration_number,
      section
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (email_lower) DO NOTHING
    RETURNING ${PUBLIC_COLUMNS};
    `,
    [
      email,
      emailLower,
      input.role,
      displayName,
      input.facultyId?.trim() || null,
      input.registrationNumber?.trim() || null,
      input.section?.trim() || null,
    ],
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
  facultyId?: string | null;
  registrationNumber?: string | null;
  section?: string | null;
}

export async function updateAccountById(id: string, input: UpdateAccountInput): Promise<TestAccountRecord | null> {
  await ensureAuthSchemaExtensions();
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

  if (input.facultyId !== undefined) {
    sets.push(`faculty_id = $${i++}`);
    values.push(input.facultyId?.trim() || null);
  }

  if (input.registrationNumber !== undefined) {
    sets.push(`registration_number = $${i++}`);
    values.push(input.registrationNumber?.trim() || null);
  }

  if (input.section !== undefined) {
    sets.push(`section = $${i++}`);
    values.push(input.section?.trim() || null);
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
  await ensureAuthSchemaExtensions();
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
  await ensureAuthSchemaExtensions();
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

export async function setAccountPassword(id: string, password: string): Promise<TestAccountRecord | null> {
  const passwordHash = await hashPassword(password);
  return setAccountPasswordHash(id, passwordHash);
}

export async function setInitialPasswordForEmail(
  email: string,
  password: string,
  profile?: {
    facultyId?: string | null;
    registrationNumber?: string | null;
    section?: string | null;
  },
): Promise<TestAccountRecord | null> {
  const account = await findAccountByEmailWithSecret(email);
  if (!account) return null;
  if (account.password_set) {
    throw new Error('A password is already set for this account.');
  }
  if (!account.is_active) {
    throw new Error('This account has been disabled. Contact the administrator.');
  }

  const passwordHash = await hashPassword(password);
  const updated = await setAccountPasswordHash(account.id, passwordHash);
  if (!updated) return null;

  if (profile) {
    return updateAccountById(account.id, profile);
  }

  return updated;
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
