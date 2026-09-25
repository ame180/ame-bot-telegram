import type { Context, MiddlewareFn } from 'grammy';

export function dropStaleUpdates(
  timeoutSeconds: number,
  nowSeconds: () => number = () => Math.floor(Date.now() / 1000),
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const message = ctx.msg;

    if (message === undefined) {
      await next();
      return;
    }

    const updateAge = nowSeconds() - (message.edit_date ?? message.date);

    if (updateAge > timeoutSeconds) {
      console.log(
        `Discarded update ${ctx.update.update_id} (age: ${updateAge}s > ${timeoutSeconds}s)`,
      );
      return;
    }

    await next();
  };
}
