import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-2 py-12 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-muted">
        That project, run or test doesn&apos;t exist.{" "}
        <Link href="/" className="underline underline-offset-2">
          Back to projects
        </Link>
      </p>
    </div>
  );
}
