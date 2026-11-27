"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";
import { navLinkClass } from "@/lib/helpers";
import type { NavLinkProps } from "@/types/dashboard.types";

export function NavLink({ href, exact, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={navLinkClass(active)}>
      {children}
    </Link>
  );
}
