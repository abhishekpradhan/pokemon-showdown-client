import { expect, test as base } from '@playwright/test';

/** Every workflow fails on uncaught page errors, including the dev-server socket. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await use(errors);
      expect(errors, 'Uncaught browser errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
