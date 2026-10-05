/**
 * Admin utilities. Authorization: the middleware verifies the token but not the role — that's
 * the API's job (adminApi: RequireRole). The UI hides the Admin nav without a role, but this
 * is UX only, not a security boundary. As per FRONTEND-BFF guide §6: middleware gate exists,
 * but enforcement is API-side.
 */
export function isAdmin(roles: string[] | undefined): boolean {
  return (roles ?? []).some((r) => r === 'Admin' || r === 'SuperAdmin');
}
