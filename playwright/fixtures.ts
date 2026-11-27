import { test as base } from "@playwright/test";
import { loadAppConfigSync } from "../src/lib/app-config";

const app = loadAppConfigSync(process.env.QA_APP!);
const bypassSecret = app.bypassSecretEnv ? process.env[app.bypassSecretEnv] : undefined;
if (app.bypassSecretEnv && !bypassSecret) throw new Error(`Set ${app.bypassSecretEnv} in .env`);

export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    if (bypassSecret && baseURL) {
      await context.route(`${new URL(baseURL).origin}/**`, (route) => route.continue({ headers: { ...route.request().headers(), "x-vercel-protection-bypass": bypassSecret } }));
    }
    await provide(context);
  }
});

export { expect } from "@playwright/test";
