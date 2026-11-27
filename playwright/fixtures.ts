import { test as base } from "@playwright/test";
import { bypassSecret, loadAppConfigSync } from "../src/lib/app-config";

const secret = bypassSecret(loadAppConfigSync(process.env.QA_APP!));

export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    if (secret && baseURL) {
      await context.route(`${new URL(baseURL).origin}/**`, (route) => route.continue({ headers: { ...route.request().headers(), "x-vercel-protection-bypass": secret } }));
    }
    await provide(context);
  }
});

export { expect } from "@playwright/test";
