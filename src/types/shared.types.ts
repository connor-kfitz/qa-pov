import type { z } from "zod";
import type { apps, artifacts, claudeCalls, depthEnum, runs, scenarioEnum, testCases } from "@/db/schema";
import type { appConfigSchema, roleSchema } from "@/lib/app-config";

export type App = typeof apps.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type TestCase = typeof testCases.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type ClaudeCall = typeof claudeCalls.$inferSelect;

export type Scenario = (typeof scenarioEnum.enumValues)[number];
export type Depth = (typeof depthEnum.enumValues)[number];
export type RunStatus = Run["status"];
export type RunScope = Pick<Run, "scenario" | "featureRef" | "compareRef">;
export type CaseStatus = TestCase["status"];
export type Verdict = NonNullable<TestCase["verdict"]>;
export type CaseCounts = Record<CaseStatus, number>;

export type AppConfig = z.infer<typeof appConfigSchema>;
export type RoleConfig = z.infer<typeof roleSchema>;
