import type { ReactNode } from "react";
import type { App, Run, RunStatus, Scenario, TestCase } from "@/types/shared.types";

export interface FormState {
  error?: string;
}

export interface Project {
  slug: string;
  name: string;
  baseUrl: string;
  roles: string[];
  app: App | null;
  runCount: number;
  latestRun: Run | null;
}

export interface ProjectRun {
  run: Run;
  cases: TestCase[];
  costUsd: number | null;
}

export type StepCosts = Partial<Record<RunStatus, number>>;

export interface RunGroup {
  key: string;
  label: string;
  kind: Scenario;
  runs: ProjectRun[];
}

export interface AppOption {
  slug: string;
  name: string;
  baseUrl: string;
  compareBranch: string;
  roles: string[];
  branches: string[];
}

export interface RoleRow {
  key: number;
  name: string;
  loginUrl: string;
  skip: boolean;
}

export interface Crumb {
  href: string;
  label: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  aside?: ReactNode;
}

export interface NavLinkProps {
  href: string;
  exact?: boolean;
  children: ReactNode;
}

export interface ChoiceProps {
  name: string;
  value: string;
  title: string;
  detail: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: () => void;
}

export type Tone = "neutral" | "progress" | "success" | "danger" | "warning" | "info";

export type StepState = "done" | "current" | "failed" | "blocked" | "pending";
