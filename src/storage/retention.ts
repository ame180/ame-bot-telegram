import type { MessageStore } from './messages.js';

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;

export function pruneExpiredMessages(
  store: MessageStore,
  retentionDays: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): number {
  const prunedCount = store.pruneOlderThan(nowSeconds - retentionDays * SECONDS_PER_DAY);

  if (prunedCount > 0) {
    console.log(`Pruned ${prunedCount} messages older than ${retentionDays} days.`);
  }

  return prunedCount;
}

export function scheduleRetention(store: MessageStore, retentionDays: number): () => void {
  const prune = () => {
    try {
      pruneExpiredMessages(store, retentionDays);
    } catch (error) {
      console.error('Failed to prune messages:', error);
    }
  };

  prune();
  const interval = setInterval(prune, PRUNE_INTERVAL_MS);

  return () => clearInterval(interval);
}
