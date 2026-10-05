/**
 * "Usuń moje dane i konto" sequencing. Order matters: this service's data first (through the
 * proxy), THEN the account at authservice. If the second step fails after the first succeeded the
 * outcome is `data_deleted_account_kept`, so the user is told the truth and may retry (the first
 * step is idempotent). authservice has no deletion webhook: an account deleted elsewhere leaves rows here.
 */
export type DeleteOutcome =
  | 'done'
  | 'invalid_password'
  | 'data_deleted_account_kept'
  | 'data_deletion_failed'
  | 'signed_out';

export interface DeleteDeps {
  /** DELETE /api/v1/me/data via the proxy. Resolves with the HTTP status (0 on network failure). */
  deleteServiceData: () => Promise<number>;
  /** POST /api/auth/delete-account. Resolves with the BFF status code string. */
  deleteAccount: (password: string | undefined) => Promise<{ status: number; code: string }>;
}

export async function deleteMyDataAndAccount(password: string | undefined, deps: DeleteDeps): Promise<DeleteOutcome> {
  const first = await deps.deleteServiceData();
  if (first === 401) return 'signed_out';
  if (first < 200 || first >= 300) return 'data_deletion_failed';
  const second = await deps.deleteAccount(password);
  if (second.status === 200) return 'done';
  if (second.code === 'invalid_password') return 'invalid_password';
  return 'data_deleted_account_kept';
}
