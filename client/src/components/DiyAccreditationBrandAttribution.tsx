/** Public marketing URLs for DIY Accreditation division branding. */
export const AAUS_WEB_URL = "https://www.allaboutultrasound.com";
export const IHE_WEB_URL = "https://www.iheartecho.com";

type LinkVariant = "subtle" | "hero" | "footer" | "inline";

function linkClass(variant: LinkVariant): string {
  switch (variant) {
    case "hero":
      return "text-white/90 hover:text-white underline-offset-2 hover:underline font-medium";
    case "footer":
      return "text-white/70 hover:text-white transition-colors underline-offset-2 hover:underline";
    case "inline":
      return "text-[#189aa1] hover:text-[#157f85] underline-offset-2 hover:underline font-medium";
    default:
      return "text-gray-400 hover:text-[#189aa1] transition-colors underline-offset-2 hover:underline";
  }
}

/** "by All About Ultrasound™ | iHeartEcho™" with links to both brand sites. */
export function DiyAccreditationByline({
  variant = "subtle",
  className = "",
}: {
  variant?: LinkVariant;
  className?: string;
}) {
  const cls = linkClass(variant);
  const sepClass = variant === "hero" ? "text-white/40" : variant === "footer" ? "text-white/30" : "text-gray-300";

  return (
    <div className={`leading-tight ${className}`}>
      by{" "}
      <a href={AAUS_WEB_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        All About Ultrasound™
      </a>
      <span className={sepClass}> | </span>
      <a href={IHE_WEB_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        iHeartEcho™
      </a>
    </div>
  );
}

/** Hero badge: "Powered by All About Ultrasound™ | iHeartEcho™ Clinical Intelligence" */
export function DiyAccreditationPoweredBy({ className = "" }: { className?: string }) {
  const cls = linkClass("hero");
  return (
    <span className={className}>
      Powered by{" "}
      <a href={AAUS_WEB_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        All About Ultrasound™
      </a>
      <span className="text-white/40"> | </span>
      <a href={IHE_WEB_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        iHeartEcho™
      </a>
      {" Clinical Intelligence"}
    </span>
  );
}

/** Footer copyright with both brand links. */
export function DiyAccreditationCopyright({ className = "" }: { className?: string }) {
  const cls = linkClass("footer");
  return (
    <div className={`text-xs text-white/30 ${className}`}>
      © {new Date().getFullYear()}{" "}
      <a href={AAUS_WEB_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        All About Ultrasound™
      </a>
      <span className="text-white/20"> | </span>
      <a href={IHE_WEB_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        iHeartEcho™
      </a>
      . All rights reserved.
    </div>
  );
}

/** Inline sentence fragment for benefits / feature copy. */
export function DiyAccreditationBrandLinks({ prefix = "Expert clinical content from " }: { prefix?: string }) {
  const cls = linkClass("inline");
  return (
    <span>
      {prefix}
      <a href={AAUS_WEB_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        All About Ultrasound™
      </a>
      <span className="text-gray-400"> | </span>
      <a href={IHE_WEB_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        iHeartEcho™
      </a>
    </span>
  );
}
