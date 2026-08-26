/**
 * The platform admin for the test module is provisioned via environment
 * variable (ADMIN_EMAIL). The admin account is stored in the database and
 * sets its password through the same OTP first-login setup as other users.
 */

const ADMIN_PSEUDO_ID_PREFIX = 'admin:';

export interface ResolvedAdminConfig {
  email: string;
  emailLower: string;
  /**
   * Legacy pseudo id retained only so older signed cookies can be recognized
   * until they expire.
   */
  pseudoId: string;
  displayName: string;
}

export function resolveAdminConfig(): ResolvedAdminConfig | null {
  const email = process.env.ADMIN_EMAIL?.trim();

  if (!email) return null;

  const emailLower = email.toLowerCase();
  return {
    email,
    emailLower,
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
