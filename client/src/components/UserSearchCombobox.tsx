/**
 * UserSearchCombobox — shared component for Grant Access dialogs.
 * Provides debounced partial search by name, displayName, or email.
 * Calls trpc.platformAdmin.searchUsers and shows a dropdown of results.
 *
 * Usage:
 *   <UserSearchCombobox
 *     onSelect={(user) => setSelectedUser(user)}
 *     placeholder="Search by name or email…"
 *   />
 */
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export interface SelectedUser {
  id: number | null; // null = new user (not yet in system)
  name: string | null;
  displayName: string | null;
  email: string;
  isNew: boolean;
}

interface Props {
  onSelect: (user: SelectedUser | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function UserSearchCombobox({ onSelect, placeholder = "Search by name or email…", className, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<SelectedUser | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce the query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: results, isFetching } = trpc.platformAdmin.searchUsers.useQuery(
    { query: debouncedQuery },
    {
      enabled: debouncedQuery.length >= 2,
      staleTime: 10_000,
    }
  );

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelected(null);
    onSelect(null);
    if (value.length >= 2) setOpen(true);
    else setOpen(false);
  };

  const handleSelect = (user: { id: number; name: string | null; displayName: string | null; email: string | null }) => {
    const sel: SelectedUser = {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      email: user.email ?? "",
      isNew: false,
    };
    setSelected(sel);
    setQuery(user.displayName ?? user.name ?? user.email ?? "");
    setOpen(false);
    onSelect(sel);
  };

  // Allow selecting a raw email that wasn't found
  const handleSelectNew = () => {
    const emailVal = query.trim();
    if (!emailVal.includes("@")) return;
    const sel: SelectedUser = {
      id: null,
      name: null,
      displayName: null,
      email: emailVal,
      isNew: true,
    };
    setSelected(sel);
    setOpen(false);
    onSelect(sel);
  };

  const showDropdown = open && debouncedQuery.length >= 2;
  const noResults = showDropdown && !isFetching && results !== undefined && results.length === 0;
  const hasResults = showDropdown && results && results.length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={selected ? (selected.displayName ?? selected.name ?? selected.email) : query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          placeholder={placeholder}
          className="pl-9 pr-9"
          disabled={disabled}
          autoComplete="off"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden">
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Searching…
            </div>
          )}

          {hasResults && results!.map((user) => (
            <button
              key={user.id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(user as any); }}
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-semibold">
                {(user.displayName ?? user.name ?? user.email ?? "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{user.displayName ?? user.name ?? user.email}</p>
                {user.email && (user.displayName ?? user.name) && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
            </button>
          ))}

          {noResults && (
            <div className="px-3 py-2 space-y-1">
              <p className="text-sm text-muted-foreground">No users found for "{debouncedQuery}"</p>
              {query.includes("@") && (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  onMouseDown={(e) => { e.preventDefault(); handleSelectNew(); }}
                >
                  <User className="w-4 h-4 text-amber-500" />
                  <span>Create new account for <strong>{query.trim()}</strong></span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className={cn(
          "mt-2 rounded-lg border px-3 py-2 text-sm",
          selected.isNew
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-teal-50 border-teal-200 text-teal-800"
        )}>
          {selected.isNew ? (
            <p className="font-medium">New account will be created for <strong>{selected.email}</strong></p>
          ) : (
            <>
              <p className="font-medium">{selected.displayName ?? selected.name ?? selected.email}</p>
              {selected.email && <p className="text-xs opacity-75">{selected.email}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
