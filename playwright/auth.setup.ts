import path from "node:path";

import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import { authStatePath, loadAppConfigSync } from "../src/lib/app-config";
import { test as setup } from "./fixtures";

const slug = process.env.QA_APP!;
const app = loadAppConfigSync(slug);

function saveState(page: Page, role: string) {
  const file = authStatePath(slug, role);
  mkdirSync(path.dirname(file), { recursive: true });
  return page.context().storageState({ path: file });
}

for (const [role, cfg] of Object.entries(app.roles)) {
  if ("skip" in cfg) {
    setup(`open the app as ${role}`, async ({ page }) => {
      await page.goto("/");
      await saveState(page, role);
    });
    continue;
  }

  setup(`sign in as ${role}`, async ({ page }) => {
    const email = process.env[cfg.emailEnv];
    const password = process.env[cfg.passwordEnv];
    if (!email || !password) throw new Error(`Set ${cfg.emailEnv} and ${cfg.passwordEnv} in .env`);

    await page.goto(cfg.loginUrl);
    const loginPath = new URL(page.url()).pathname;

    const emailField = cfg.selectors?.email ? page.locator(cfg.selectors.email) : page.getByRole("textbox", { name: /^e-?mail( address)?$/i });
    const passwordField = cfg.selectors?.password ? page.locator(cfg.selectors.password) : page.getByRole("textbox", { name: /^password$/i });
    const submit = cfg.selectors?.submit ? page.locator(cfg.selectors.submit) : page.getByRole("button", { name: /sign in|log in|login/i });

    await emailField.fill(email);
    await passwordField.fill(password);
    await submit.click();
    await page.waitForURL((url) => url.pathname !== loginPath);

    await saveState(page, role);
  });
}
