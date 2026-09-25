import type { Context } from 'grammy';
import { describe, expect, it, vi } from 'vitest';
import { dropStaleUpdates } from '../src/staleUpdates.js';

function contextWith(message: { date: number; edit_date?: number } | undefined): Context {
  return { msg: message, update: { update_id: 1 } } as unknown as Context;
}

describe('dropStaleUpdates', () => {
  const middleware = dropStaleUpdates(10, () => 1_000);

  it('passes fresh messages through', async () => {
    const next = vi.fn(async () => {});

    await middleware(contextWith({ date: 995 }), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('drops messages older than the timeout', async () => {
    const next = vi.fn(async () => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await middleware(contextWith({ date: 900 }), next);

    expect(next).not.toHaveBeenCalled();
  });

  it('uses the edit date for edited messages', async () => {
    const next = vi.fn(async () => {});

    await middleware(contextWith({ date: 100, edit_date: 998 }), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('passes updates without a message through', async () => {
    const next = vi.fn(async () => {});

    await middleware(contextWith(undefined), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
