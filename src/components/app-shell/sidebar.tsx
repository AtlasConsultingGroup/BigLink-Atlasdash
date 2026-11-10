import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  FileText,
  Gauge,
  Handshake,
  Landmark,
  ReceiptText,
  Scale,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalUser } from "@/lib/portal/types";
import { LinkedInPortalLink } from "./linkedin-portal-link";

type SidebarNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  count?: number;
};

const secondaryNavigation: SidebarNavItem[] = [
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Audit trail", href: "/audit", icon: ShieldCheck },
  { label: "Settings", href: "/settings", icon: Settings },
];

function NavLink({
  item,
  activeHref,
}: {
  item: SidebarNavItem;
  activeHref: string;
}) {
  const Icon = item.icon;
  const active = activeHref === item.href;
  const count = "count" in item ? item.count : undefined;

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-ink text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-ink",
      )}
    >
      <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {count ? (
        <span className="grid size-5 place-items-center rounded-full bg-negative text-[11px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  activeHref,
  user,
  unresolvedDisputeCount,
}: {
  activeHref: string;
  user: PortalUser;
  unresolvedDisputeCount: number;
}) {
  const navigation: SidebarNavItem[] = [
    { label: "Overview", href: "/", icon: Gauge },
    { label: "Ledger", href: "/ledger", icon: BookOpenCheck },
    { label: "Referrals", href: "/referrals", icon: Handshake },
    { label: "Deals", href: "/deals", icon: BriefcaseBusiness },
    { label: "Invoices", href: "/invoices", icon: ReceiptText },
    { label: "Disputes", href: "/disputes", icon: Scale, count: unresolvedDisputeCount },
    { label: "Monthly close", href: "/statements", icon: Landmark },
  ];

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-logo">
        <Image
          src="/big-link-logo.png"
          alt="Big Link Consulting"
          width={184}
          height={64}
          priority
        />
      </div>

      <div className="workspace-label">
        <div className="workspace-mark" aria-hidden="true">
          <FileText className="size-4" />
        </div>
        <div>
          <p>Partnership ledger</p>
          <span>Atlas + Big Link</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navigation.map((item) => (
          <NavLink key={item.href} item={item} activeHref={activeHref} />
        ))}
        <LinkedInPortalLink className="min-h-10 rounded-md px-3 text-sm font-medium transition-colors text-neutral-600 hover:bg-neutral-100 hover:text-ink" />
      </nav>

      <nav className="sidebar-nav sidebar-nav-secondary" aria-label="Account navigation">
        {secondaryNavigation.map((item) => (
          <NavLink key={item.href} item={item} activeHref={activeHref} />
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="avatar">{user.initials}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-xs text-neutral-500">{user.role}</p>
        </div>
      </div>
    </aside>
  );
}
