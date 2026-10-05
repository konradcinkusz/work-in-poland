import { describe, expect, it, vi } from 'vitest';
import { deleteMyDataAndAccount } from './delete-account';

const ok = { status: 200, code: 'ok' };

describe('deleteMyDataAndAccount', () => {
  it('deletes service data FIRST, then the account, passing the password', async () => {
    const order: string[] = [];
    const out = await deleteMyDataAndAccount('pw', {
      deleteServiceData: async () => { order.push('data'); return 204; },
      deleteAccount: async (p) => { order.push(`account:${p}`); return ok; },
    });
    expect(out).toBe('done');
    expect(order).toEqual(['data', 'account:pw']);
  });

  it('does not touch the account when the data deletion fails', async () => {
    const deleteAccount = vi.fn(async () => ok);
    expect(await deleteMyDataAndAccount(undefined, { deleteServiceData: async () => 500, deleteAccount })).toBe('data_deletion_failed');
    expect(await deleteMyDataAndAccount(undefined, { deleteServiceData: async () => 0, deleteAccount })).toBe('data_deletion_failed');
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('reports a signed-out session', async () => {
    expect(await deleteMyDataAndAccount(undefined, { deleteServiceData: async () => 401, deleteAccount: async () => ok })).toBe('signed_out');
  });

  it('is honest when the account step fails after the data step succeeded', async () => {
    expect(await deleteMyDataAndAccount('pw', { deleteServiceData: async () => 204, deleteAccount: async () => ({ status: 502, code: 'unavailable' }) })).toBe('data_deleted_account_kept');
  });

  it('a wrong password is its own outcome (data is already gone; retry works)', async () => {
    expect(await deleteMyDataAndAccount('bad', { deleteServiceData: async () => 204, deleteAccount: async () => ({ status: 400, code: 'invalid_password' }) })).toBe('invalid_password');
  });

  it('OAuth-only accounts send no password', async () => {
    const deleteAccount = vi.fn(async () => ok);
    await deleteMyDataAndAccount(undefined, { deleteServiceData: async () => 204, deleteAccount });
    expect(deleteAccount).toHaveBeenCalledWith(undefined);
  });
});
