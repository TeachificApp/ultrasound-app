/**
 * PublishDomainSelect — reusable per-item publish domain override selector.
 * Fetches the list of custom domains from the admin API and renders a Select
 * with a "Use global default" option. Pass value="" to represent "no override".
 */
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PublishDomainSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PublishDomainSelect({ value, onChange, className }: PublishDomainSelectProps) {
  const { data: domainsData } = trpc.lmsAdmin.getCustomDomains.useQuery();
  const domains: string[] = domainsData?.domains ?? [];

  return (
    <Select
      value={value || "__default__"}
      onValueChange={(v) => onChange(v === "__default__" ? "" : v)}
    >
      <SelectTrigger className={className ?? "mt-1 text-sm"}>
        <SelectValue placeholder="Use global default" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__default__">Use global default</SelectItem>
        {domains.map((d) => (
          <SelectItem key={d} value={d}>{d}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
