export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">qa-pov</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Dashboard coming soon: start a run, list runs, run detail, test detail.
        For now, start runs from the terminal with <code>pnpm qa</code>.
      </p>
    </main>
  );
}
