import Link from "next/link";
import { Bell, ChevronDown, Menu } from "lucide-react";
import type { PortalUser } from "@/lib/portal/types";
import { LinkedInPortalLink } from "./linkedin-portal-link";

export function Topbar({ user }: { user: PortalUser }) {
  return (
    <header className="topbar">
      <details className="mobile-menu">
        <summary aria-label="Open navigation">
          <Menu className="size-5" />
        </summary>
        <nav>
          <Link href="/">Overview</Link>
          <Link href="/ledger">Ledger</Link>
          <Link href="/referrals">Referrals</Link>
          <Link href="/deals">Deals</Link>
          <Link href="/invoices">Invoices</Link>
          <Link href="/disputes">Disputes</Link>
          <Link href="/statements">Monthly close</Link>
          <LinkedInPortalLink />
        </nav>
      </details>

      <div className="topbar-title">
        <p>Shared financial position</p>
        <span>{user.company} workspace, MFA protected</span>
      </div>

      <div className="topbar-actions">
        <button className="period-control" type="button">
          July 2026
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell className="size-[18px]" />
          <span className="notification-dot" />
        </button>
      </div>
    </header>
  );
}
