import { useState } from "react";
import { useQuizStore } from "../store/quizStore";
import { X, Key, CheckCircle2, AlertCircle, Unlock } from "lucide-react";

interface Props {
  onClose: () => void;
}

// Simple HMAC-style validation: Pro keys start with "TPQ-PRO-", Enterprise with "TPQ-ENT-"
function validateLicenseKey(key: string): "free" | "pro" | "enterprise" | null {
  const k = key.trim().toUpperCase();
  if (k.startsWith("TPQ-ENT-") && k.length >= 20) return "enterprise";
  if (k.startsWith("TPQ-PRO-") && k.length >= 20) return "pro";
  if (k === "") return "free";
  return null; // invalid
}

export function LicenseManager({ onClose }: Props) {
  const { license, setLicense, clearLicense } = useQuizStore();
  const [keyInput, setKeyInput] = useState(license.licenseKey ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleActivate = () => {
    setError("");
    setSuccess(false);
    const tier = validateLicenseKey(keyInput);
    if (tier === null) {
      setError("Invalid license key. Keys must start with TPQ-PRO- or TPQ-ENT-.");
      return;
    }
    setLicense({
      tier,
      licenseKey: keyInput.trim() || null,
      validatedAt: new Date().toISOString(),
    });
    setSuccess(true);
  };

  const handleClear = () => {
    clearLicense();
    setKeyInput("");
    setSuccess(false);
    setError("");
  };

  const tierInfo = {
    free: {
      label: "Free",
      color: "text-gray-600",
      bg: "bg-gray-100",
      description: "Up to 5 quizzes, 10 questions each. No encryption.",
    },
    pro: {
      label: "Pro",
      color: "text-teal-700",
      bg: "bg-teal-100",
      description: "Unlimited quizzes and questions. AES-256 encrypted .quiz files. Teachific publish.",
    },
    enterprise: {
      label: "Enterprise",
      color: "text-purple-700",
      bg: "bg-purple-100",
      description: "All Pro features plus bulk export, team sharing, and API access.",
    },
  }[license.tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-teal-500" />
            <h2 className="text-lg font-bold text-gray-800">License</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current status */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${tierInfo.bg}`}>
            <Unlock className={`w-5 h-5 ${tierInfo.color}`} />
            <div>
              <p className={`text-sm font-bold ${tierInfo.color}`}>{tierInfo.label} Plan Active</p>
              <p className={`text-xs ${tierInfo.color} opacity-80`}>{tierInfo.description}</p>
            </div>
          </div>

          {/* License key input */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              License Key
            </label>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setError(""); setSuccess(false); }}
              placeholder="TPQ-PRO-XXXX-XXXX-XXXX"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400/50 font-mono"
            />
            {error && (
              <div className="flex items-center gap-1.5 mt-1.5 text-red-500 text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-1.5 mt-1.5 text-teal-600 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                License activated successfully!
              </div>
            )}
          </div>

          {/* Feature comparison */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold">Feature</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-semibold">Free</th>
                  <th className="text-center px-3 py-2 text-teal-600 font-semibold">Pro</th>
                  <th className="text-center px-3 py-2 text-purple-600 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Quizzes", "5", "∞", "∞"],
                  ["Questions/quiz", "10", "∞", "∞"],
                  ["Encrypted .quiz files", "✗", "✓", "✓"],
                  ["Publish to Teachific", "✗", "✓", "✓"],
                  ["Bulk export", "✗", "✗", "✓"],
                  ["Team sharing", "✗", "✗", "✓"],
                ].map(([feature, free, pro, ent]) => (
                  <tr key={feature} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-700">{feature}</td>
                    <td className="text-center px-3 py-2 text-gray-500">{free}</td>
                    <td className="text-center px-3 py-2 text-teal-600 font-medium">{pro}</td>
                    <td className="text-center px-3 py-2 text-purple-600 font-medium">{ent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Purchase a license at{" "}
            <a href="https://teachific.app" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
              teachific.app
            </a>
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          {license.licenseKey && (
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Remove License
            </button>
          )}
          <button
            onClick={handleActivate}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
          >
            Activate
          </button>
        </div>
      </div>
    </div>
  );
}
