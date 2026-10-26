/** Length-only policy (NIST 800-63B): no composition rules. Breached passwords are rejected server-side. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

export function passwordProblem(password: string): string | null {
  const len = [...password].length;
  if (len < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  return null;
}
