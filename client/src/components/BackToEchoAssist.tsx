/**
 * BackToEchoAssist — compatibility shim for All About Ultrasound pages copied into UltrasoundAssist.
 * Renders a "Back to UltrasoundAssist" button pointing at /ultrasound-assist-hub.
 */
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

interface BackToEchoAssistProps {
  className?: string;
}

export default function BackToEchoAssist({ className }: BackToEchoAssistProps) {
  return (
    <Link href="/ultrasound-assist">
      <button
        className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-[#f0fbfc] ${className ?? ""}`}
        style={{ borderColor: "#189aa1" + "50", color: className ? undefined : "#189aa1" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to UltrasoundAssist™
      </button>
    </Link>
  );
}
