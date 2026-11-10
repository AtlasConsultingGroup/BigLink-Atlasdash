import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKEDIN_PORTAL_URL = "https://big-link-portal.vercel.app/";

export function LinkedInPortalLink({ className }: { className?: string }) {
  return (
    <a
      href={LINKEDIN_PORTAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("flex items-center gap-3", className)}
    >
      <ExternalLink aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">LinkedIn</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
