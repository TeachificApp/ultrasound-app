import { useState } from "react";
import { resolveAssetUrl } from "@/lib/resolveAssetUrl";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  displayName?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export default function UserAvatar({
  avatarUrl,
  name,
  displayName,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const resolved = resolveAssetUrl(avatarUrl ?? undefined);
  const label = displayName || name || "?";
  const initial = label.charAt(0).toUpperCase();

  if (!resolved || broken) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full flex-shrink-0",
          "bg-gradient-to-br from-[#189aa1] to-[#4ad9e0] text-white font-bold",
          fallbackClassName ?? className,
        )}
      >
        <span className="text-xs">{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={label}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
