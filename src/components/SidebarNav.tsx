"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Home,
  LayoutDashboard,
  UploadCloud,
  Trophy,
  LogIn,
} from "lucide-react";

export function SidebarNav() {
  const pathname = usePathname();
  const items = [
    { label: "Home", href: "/", icon: Home },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Imports", href: "/imports", icon: UploadCloud },
    { label: "Tournaments", href: "/tournaments", icon: Trophy },
    { label: "Sign In", href: "/signin", icon: LogIn },
  ];

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/"
          ? pathname === "/"
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              buttonVariants({
                variant: "ghost",
                className:
                  "justify-start gap-3 text-sm font-medium transition",
              }),
              isActive
                ? "bg-accent text-accent-foreground hover:bg-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}


