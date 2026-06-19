/**
 * Renders CMS-managed navigation links (header, sidebar, or profile dropdown).
 */
import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteNavLinkItem } from "@/hooks/useSiteNavMenu";

type Variant = "header" | "sidebar" | "profile";

function NavAnchor({
  item,
  variant,
  isActive,
  onNavigate,
  className,
}: {
  item: SiteNavLinkItem;
  variant: Variant;
  isActive?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const external = item.external || item.openInNewTab;
  const baseClass =
    variant === "header"
      ? cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          isActive ? "bg-[#189aa1]/10 text-[#189aa1]" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )
      : variant === "sidebar"
        ? cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full",
            isActive ? "bg-[#189aa1]/15 text-[#189aa1] font-medium" : "text-gray-300 hover:bg-white/10 hover:text-white",
          )
        : cn(
            "px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 w-full text-left",
            isActive ? "text-teal-700 font-medium" : "text-gray-700",
          );

  if (external) {
    return (
      <a
        href={item.href}
        target={item.openInNewTab ? "_blank" : undefined}
        rel={item.openInNewTab ? "noopener noreferrer" : undefined}
        className={cn(baseClass, className)}
        onClick={onNavigate}
      >
        {item.label}
        {variant !== "profile" && <ExternalLink className="w-3 h-3 opacity-60" />}
      </a>
    );
  }

  return (
    <Link href={item.href} onClick={onNavigate}>
      <div className={cn(baseClass, "cursor-pointer", className)}>{item.label}</div>
    </Link>
  );
}

function HeaderDropdown({
  item,
  location,
  onNavigate,
}: {
  item: SiteNavLinkItem;
  location: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const childActive = item.children?.some((c) => location.startsWith(c.href)) ?? false;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          childActive ? "bg-[#189aa1]/10 text-[#189aa1]" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        {item.label}
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 min-w-[180px] bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            {item.children!.map((child) => (
              <div key={child.href + child.label} className="px-1">
                <NavAnchor
                  item={child}
                  variant="header"
                  isActive={location.startsWith(child.href)}
                  onNavigate={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="rounded-md w-full"
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SiteNavHeaderLinks({
  items,
  location,
  onNavigate,
  className,
}: {
  items: SiteNavLinkItem[];
  location: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {items.map((item) => {
        if (item.children && item.children.length > 0) {
          return (
            <HeaderDropdown key={item.href + item.label} item={item} location={location} onNavigate={onNavigate} />
          );
        }
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <NavAnchor
            key={item.href + item.label}
            item={item}
            variant="header"
            isActive={isActive}
            onNavigate={onNavigate}
          />
        );
      })}
    </nav>
  );
}

export function SiteNavSidebarLinks({
  items,
  location,
  onNavigate,
}: {
  items: SiteNavLinkItem[];
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <div key={item.href + item.label}>
            <NavAnchor item={item} variant="sidebar" isActive={isActive} onNavigate={onNavigate} />
            {item.children && item.children.length > 0 && (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                {item.children.map((child) => (
                  <NavAnchor
                    key={child.href + child.label}
                    item={child}
                    variant="sidebar"
                    isActive={location.startsWith(child.href)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function SiteNavProfileLinks({
  items,
  location,
  onNavigate,
}: {
  items: SiteNavLinkItem[];
  location: string;
  onNavigate?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <div className="border-t border-gray-100 my-1" />
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Pages</div>
      {items.map((item) => (
        <NavAnchor
          key={item.href + item.label}
          item={item}
          variant="profile"
          isActive={location.startsWith(item.href)}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}
