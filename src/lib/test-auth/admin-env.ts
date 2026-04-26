/**
 * The platform admin for the test module is provisioned via environment
 * variables (ADMIN_EMAIL + ADMIN_PASSWORD). The admin account is not stored
 * in the database, which keeps the credential rotation under deployment
 * control instead of through the UI.
 */

const ADMIN_PSEUDO_ID_PREFIX = 'admin:';

export interface ResolvedAdminConfig {
  email: string;
  emailLower: string;
  password: string;
  /**
   * Stable pseudo id for the env-provisioned admin. We never persist a row
   * for the admin in test_module_accounts, so this id is derived from the
   * configured email.
   */
  pseudoId: string;
  displayName: string;
}

export function resolveAdminConfig(): ResolvedAdminConfig | null {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) return null;

  const emailLower = email.toLowerCase();
  return {
    email,
    emailLower,
    password,
    pseudoId: `${ADMIN_PSEUDO_ID_PREFIX}${emailLower}`,
    displayName: deriveDisplayName(email),
  };
}

export function isAdminPseudoId(value: string | null | undefined): boolean {
  return !!value && value.startsWith(ADMIN_PSEUDO_ID_PREFIX);
}

export function deriveDisplayName(email: string): string {
  const trimmed = email.trim();
  const local = trimmed.split('@')[0] ?? trimmed;
  if (!local) return trimmed;
  // Replace separators with spaces and title-case the result.
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return trimmed;
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
