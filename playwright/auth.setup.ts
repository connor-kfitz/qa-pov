import path from "node:path";

import { mkdirSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { authStatePath, loadAppConfigSync } from "../src/lib/app-config";

const slug = process.env.QA_APP!;
const app = loadAppConfigSync(slug);

for (const [role, cfg] of Object.entries(app.roles)) {
  if ("skip" in cfg) continue;

  setup(`sign in as ${role}`, async ({ page }) => {
    const email = process.env[cfg.emailEnv];
    const password = process.env[cfg.passwordEnv];
    if (!email || !password) throw new Error(`Set ${cfg.emailEnv} and ${cfg.passwordEnv} in .env`);

    await page.goto(cfg.loginUrl);

    const emailField = cfg.selectors?.email ? page.locator(cfg.selectors.email) : page.getByLabel(/email/i);
    const passwordField = cfg.selectors?.password ? page.locator(cfg.selectors.password) : page.getByLabel(/password/i);
    const submit = cfg.selectors?.submit ? page.locator(cfg.selectors.submit) : page.getByRole("button", { name: /sign in|log in|login/i });

    await emailField.fill(email);
    await passwordField.fill(password);
    await submit.click();
    await page.waitForURL((url) => !url.pathname.startsWith(cfg.loginUrl));

    const file = authStatePath(slug, role);
    mkdirSync(path.dirname(file), { recursive: true });
    await page.context().storageState({ path: file });
  });
}
