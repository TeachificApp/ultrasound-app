import type { Brand } from "@shared/brands";
import { getAdminBrandLabel } from "@/hooks/useAdminBrand";

export default function BrandAdminBadge({ brand }: { brand: Brand }) {
  const isIHE = brand === "iheartecho";
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: isIHE ? "rgba(190,24,93,0.15)" : "rgba(24,154,161,0.15)",
        color: isIHE ? "#f9a8d4" : "#4ad9e0",
        border: `1px solid ${isIHE ? "rgba(190,24,93,0.35)" : "rgba(74,217,224,0.35)"}`,
      }}
    >
      {getAdminBrandLabel(brand)}
    </span>
  );
}
