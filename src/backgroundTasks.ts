export class BackgroundTasks {
  private readonly pending = new Set<Promise<void>>();

  run(label: string, task: () => Promise<void>): void {
    const promise = task()
      .catch((error: unknown) => console.error(`Background task "${label}" failed:`, error))
      .finally(() => this.pending.delete(promise));

    this.pending.add(promise);
  }

  async drain(): Promise<void> {
    await Promise.all([...this.pending]);
  }
}
