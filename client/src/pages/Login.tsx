/**
 * Login.tsx — Magic-link + Email/Password sign-in
 * Brand-aware: detects AAUS-only vs combined (AAUS | iHeartEcho) on learn/members subdomains.
 * Brand: Teal #189aa1, Aqua #4ad9e0, Dark navy #0e1e2e
 *
 * Modes:
 *   "magic"    → Enter email → receive magic link → click link → authenticated
 *   "password" → Enter email + password → sign in immediately
 *   "register" → Enter name + email + password → create account
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, Stethoscope, BookOpen, Shield, CheckCircle2, Zap, ArrowLeft, GraduationCap, Award, Users, Eye, EyeOff, Lock, UserPlus, KeyRound } from "lucide-react";
import { isCombinedBrandingDomain, isIHeartEchoDomain, isLearnDomain, MEMBERS_APP_URL } from "@/hooks/useSubdomain";
import { toast } from "sonner";

const LOGO = import.meta.env.VITE_APP_LOGO as string;
const IHE_LOGO = "/manus-storage/iheartecho-logo_f9d91cd4.webp";

type LoginMode = "magic" | "password" | "register";

export default function Login() {
  // Evaluate at render time so these reflect the actual hostname (not module-load hostname)
  const isCombined = isCombinedBrandingDomain();
  const isIHE = isIHeartEchoDomain();
  const BRAND_NAME = isIHE
    ? "iHeartEcho™"
    : isCombined
    ? "All About Ultrasound™ | iHeartEcho™"
    : "All About Ultrasound™";
  const BRAND_SUBTITLE = isIHE
    ? "Expert Echocardiography Education & CME"
    : isCombined
    ? "Expert Ultrasound Education, CME & Registry Review"
    : "Expert Ultrasound Education & Registry Review";
  const HERO_HEADLINE = isIHE
    ? <>World-Class Echo<br /><span style={{ color: "#4ad9e0" }}>Education & CME</span></>
    : <>Expert Ultrasound<br /><span style={{ color: "#4ad9e0" }}>Education & CME</span></>;
  const HERO_BODY = isIHE
    ? "Comprehensive echocardiography education for sonographers, cardiologists, and echo learners — accredited CME courses, registry review, and expert-led learning."
    : "Comprehensive ultrasound education for sonographers, physicians, and learners — accredited CME courses, registry review, and expert-led learning for every modality.";
  const FEATURES = isIHE
    ? [
      { icon: GraduationCap, title: "Accredited CME Courses", desc: "SDMS, ASRT & ARDMS-accepted continuing medical education" },
      { icon: Award, title: "Registry Review", desc: "Structured prep for RDCS, RCS, and echocardiography boards" },
      { icon: BookOpen, title: "Echo Case Library", desc: "Image, video, and scenario-based echocardiography cases" },
      { icon: Users, title: "Expert Instructors", desc: "Learn from leading sonographers, cardiologists & educators" },
    ]
    : [
      { icon: GraduationCap, title: "Accredited CME Courses", desc: "SDMS, ASRT & ARDMS-accepted continuing medical education" },
      { icon: Award, title: "Registry Review", desc: "Structured prep for RDMS, RVT, RDCS & specialty boards" },
      { icon: BookOpen, title: "500+ Ultrasound Cases", desc: "Image and video cases across all modalities" },
      { icon: Users, title: "Expert Instructors", desc: "Learn from leading sonographers, physicians & educators" },
    ];

  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // ── Form state ──
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Read returnTo from URL so magic link redirects back after login.
  // Sanitize: never redirect back to auth pages (would cause a loop).
  const AUTH_PATHS = ["/login", "/register", "/magic-link", "/auth/magic", "/auth/access", "/forgot-password", "/reset-password"];
  const rawReturnTo = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("returnTo") ?? undefined : undefined;
  const returnTo = rawReturnTo && !AUTH_PATHS.some(p => rawReturnTo === p || rawReturnTo.startsWith(p + "?")) ? rawReturnTo : undefined;

  // On the learn subdomain:
  // - If there's a returnTo (e.g. /courses/my-course/player), stay on learn domain
  // - If no returnTo, default to /my-dashboard on the learn domain itself.
  //   StudentDashboardPage is served at /my-dashboard on learn — no loop.
  const postLoginUrl = returnTo ?? "/my-dashboard";

  // Detect if user just logged out — don't auto-redirect back
  const isPostLogout = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("logout");

  // Redirect if already signed in (but NOT if user just clicked logout)
  useEffect(() => {
    if (isPostLogout) return; // User explicitly logged out — stay on login page
    if (!loading && isAuthenticated) {
      // Always navigate to postLoginUrl (relative /my-dashboard or explicit returnTo).
      // On the learn domain this keeps the student on learn.allaboutultrasound.com.
      navigate(postLoginUrl);
    }
  }, [isAuthenticated, loading, navigate, postLoginUrl, isPostLogout]);

  // ── Magic link mutation ──
  const requestMutation = trpc.auth.requestMagicLink.useMutation({
    onSuccess: () => setSent(true),
  });

  // ── Register mutation ──
  const registerMutation = trpc.auth.registerWithPassword.useMutation({
    onSuccess: () => {
      window.location.href = postLoginUrl;
    },
    onError: (err) => {
      toast.error(err.message || "Registration failed. Please try again.");
    },
  });

  const handleMagicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || requestMutation.isPending) return;
    requestMutation.mutate({ email: trimmed, origin: window.location.origin, returnTo });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password || passwordLoading) return;
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-App-Hostname": window.location.hostname,
        },
        body: JSON.stringify({
          email: trimmed,
          password,
          host: window.location.hostname,
        }),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        const message = data.error || "Sign-in failed. Please check your credentials.";
        setPasswordError(message);
        toast.error(message);
        return;
      }
      window.location.href = postLoginUrl;
    } catch {
      const message = "Sign-in failed. Please try again.";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password || registerMutation.isPending) return;
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    registerMutation.mutate({
      email: trimmed,
      password,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    });
  };

  const switchMode = (newMode: LoginMode) => {
    setMode(newMode);
    setSent(false);
    setPassword("");
    setPasswordError(null);
    registerMutation.reset();
    requestMutation.reset();
  };

  // Show redirect spinner when already authenticated (but not post-logout)
  if (!loading && isAuthenticated && !isPostLogout) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0e1e2e" }}>
        <div className="w-8 h-8 border-2 border-[#189aa1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ fontFamily: "Open Sans, sans-serif" }}>
      {/* ── Left panel: branding ── */}
      <div
        className="relative flex flex-col justify-between p-8 lg:p-12 lg:w-[55%] overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0e1e2e 0%, #0d3d44 55%, #189aa1 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, #4ad9e0 0%, transparent 50%),
                              radial-gradient(circle at 75% 75%, #189aa1 0%, transparent 50%)`,
          }}
        />
        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center gap-1">
            {isIHE
              ? <img src={IHE_LOGO} alt="iHeartEcho™" className="w-16 h-16 object-contain drop-shadow-lg" />
              : LOGO
              ? <img src={LOGO} alt="All About Ultrasound™" className="w-16 h-16 object-contain drop-shadow-lg" />
              : null
            }
            {!LOGO && !isCombined && !isIHE && (
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(24,154,161,0.3)" }}>
                <Stethoscope className="w-10 h-10 text-white" />
              </div>
            )}
          </div>
          <div>
            <div className="text-2xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>{BRAND_NAME}</div>
            <div className="text-xs font-medium" style={{ color: "#4ad9e0" }}>{BRAND_SUBTITLE}</div>
          </div>
        </div>
        {/* Hero */}
        <div className="relative my-8 lg:my-0">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4 border border-white/20 bg-white/10">
            <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
            <span className="text-xs text-white/80 font-medium">Trusted by Sonographers Worldwide</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4" style={{ fontFamily: "Merriweather, serif" }}>
            {HERO_HEADLINE}
          </h1>
          <p className="text-white/70 text-sm leading-relaxed max-w-sm">
            {HERO_BODY}
          </p>
        </div>
        {/* Features */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(24,154,161,0.3)" }}>
                <Icon className="w-4 h-4" style={{ color: "#4ad9e0" }} />
              </div>
              <div>
                <div className="text-white text-xs font-semibold mb-0.5">{title}</div>
                <div className="text-white/50 text-xs leading-snug">{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="relative mt-8 lg:mt-0 text-white/30 text-xs">&copy; {new Date().getFullYear()} {BRAND_NAME}</div>
      </div>

      {/* ── Right panel: auth forms ── */}
      <div className="flex flex-col items-center justify-center flex-1 p-8 lg:p-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            {isIHE
              ? <img src={IHE_LOGO} alt="iHeartEcho™" className="w-10 h-10 object-contain" />
              : LOGO
              ? <img src={LOGO} alt="All About Ultrasound™" className="w-10 h-10 object-contain" />
              : <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#189aa1" }}><Stethoscope className="w-5 h-5 text-white" /></div>
            }
            <div className="text-xl font-black" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>{BRAND_NAME}</div>
          </div>

          {/* ── Magic link sent confirmation ── */}
          {mode === "magic" && sent ? (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-black mb-2" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>
                  Check your inbox
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  If <span className="font-semibold text-gray-700">{email.trim()}</span> is registered, a sign-in link is on its way.
                </p>
              </div>
              <div className="inline-flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left w-full">
                <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 leading-relaxed space-y-1">
                  <p>The link expires in <strong>15 minutes</strong> and can only be used once.</p>
                  <p>&#128236; <strong>Don't see it?</strong> Check your <strong>spam</strong> or <strong>junk</strong> folder &mdash; the email comes from <span className="font-medium">{BRAND_NAME}</span>.</p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => { setSent(false); setEmail(""); requestMutation.reset(); }}
                  className="text-sm font-medium hover:underline block mx-auto"
                  style={{ color: "#189aa1" }}
                >
                  Try a different email address
                </button>
                <button
                  onClick={() => switchMode("password")}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mx-auto"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Sign in with password instead
                </button>
              </div>
            </div>

          ) : mode === "magic" ? (
            /* ── Magic link form ── */
            <>
              <div className="mb-8">
                <div className="w-14 h-14 rounded-full bg-[#f0fbfc] flex items-center justify-center mb-4">
                  <Mail className="w-7 h-7" style={{ color: "#189aa1" }} />
                </div>
                <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>
                  Sign in to {BRAND_NAME}
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Enter your email and we'll send you a one-click sign-in link.
                </p>
              </div>

              <form onSubmit={handleMagicSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email-magic" className="text-sm font-medium text-gray-700">Email address</Label>
                  <Input
                    id="email-magic"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                    disabled={requestMutation.isPending}
                  />
                  {requestMutation.isError && (
                    <p className="text-xs text-red-500 mt-1">
                      {requestMutation.error?.message || "Something went wrong. Please try again."}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={requestMutation.isPending || !email.trim()}
                  className="w-full h-11 font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #189aa1 0%, #0e7a80 100%)" }}
                >
                  {requestMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending link&hellip;</>
                  ) : (
                    <><Mail className="w-4 h-4 mr-2" />Send Magic Link</>
                  )}
                </Button>
              </form>

              <div className="mt-5 flex items-start gap-2 bg-[#f0fbfc] border border-[#189aa1]/20 rounded-xl px-4 py-3">
                <Zap className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-600 leading-relaxed space-y-1">
                  <p>The link expires in <strong>15 minutes</strong> and can only be used once.</p>
                  <p>&#128236; <strong>Don't see it?</strong> Check your <strong>spam</strong> or <strong>junk</strong> folder.</p>
                </div>
              </div>

              {/* Switch to password */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <button
                onClick={() => switchMode("password")}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Sign in with password
              </button>
              <button
                onClick={() => switchMode("register")}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors mt-2"
              >
                <UserPlus className="w-4 h-4" />
                Create a new account
              </button>

              <p className="mt-6 text-xs text-gray-400 text-center leading-relaxed">
                By signing in you agree to the{" "}
                <a href="https://www.allaboutultrasound.com/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Terms of Service</a>
                {" "}and{" "}
                <a href="https://www.allaboutultrasound.com/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Privacy Policy</a>.
              </p>
            </>

          ) : mode === "password" ? (
            /* ── Password sign-in form ── */
            <>
              <div className="mb-8">
                <div className="w-14 h-14 rounded-full bg-[#f0fbfc] flex items-center justify-center mb-4">
                  <KeyRound className="w-7 h-7" style={{ color: "#189aa1" }} />
                </div>
                <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>
                  Sign in with password
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Enter your email and password to access your account. First time? Use <Link href="/forgot-password" className="underline" style={{ color: "#189aa1" }}>Forgot password</Link> to set one.
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-pw" className="text-sm font-medium text-gray-700">Email address</Label>
                  <Input
                    id="email-pw"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                    disabled={passwordLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password-pw" className="text-sm font-medium text-gray-700">Password</Label>
                    <Link href="/forgot-password" className="text-xs hover:underline" style={{ color: "#189aa1" }}>
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password-pw"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10"
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <div className="mt-1">
                      <p className="text-xs text-red-500">
                        {passwordError}
                      </p>
                      {passwordError.includes("magic link") && (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => switchMode("magic")}
                            className="flex-1 text-xs py-2 px-3 rounded-lg font-medium text-white"
                            style={{ background: "linear-gradient(135deg, #189aa1 0%, #0e7a80 100%)" }}
                          >
                            Send Magic Link
                          </button>
                          <Link
                            href="/forgot-password"
                            className="flex-1 text-xs py-2 px-3 rounded-lg font-medium text-center border border-gray-200 text-gray-600 hover:bg-gray-50"
                          >
                            Set a Password
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={passwordLoading || !email.trim() || !password}
                  className="w-full h-11 font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #189aa1 0%, #0e7a80 100%)" }}
                >
                  {passwordLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in&hellip;</>
                  ) : "Sign In"}
                </Button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">other options</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => switchMode("magic")}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Send me a magic link instead
                </button>
                <button
                  onClick={() => switchMode("register")}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Create a new account
                </button>
              </div>
            </>

          ) : (
            /* ── Register form ── */
            <>
              <div className="mb-8">
                <div className="w-14 h-14 rounded-full bg-[#f0fbfc] flex items-center justify-center mb-4">
                  <UserPlus className="w-7 h-7" style={{ color: "#189aa1" }} />
                </div>
                <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "Merriweather, serif", color: "#0e1e2e" }}>
                  Create your account
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Join {BRAND_NAME} to access courses, CME, and more.
                </p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      autoFocus
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-11"
                      disabled={registerMutation.isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-11"
                      disabled={registerMutation.isPending}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-reg" className="text-sm font-medium text-gray-700">Email address</Label>
                  <Input
                    id="email-reg"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                    disabled={registerMutation.isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password-reg" className="text-sm font-medium text-gray-700">Password</Label>
                  <div className="relative">
                    <Input
                      id="password-reg"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 pr-10"
                      disabled={registerMutation.isPending}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {registerMutation.isError && (
                    <p className="text-xs text-red-500 mt-1">
                      {registerMutation.error?.message || "Registration failed. Please try again."}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={registerMutation.isPending || !email.trim() || !password || password.length < 8}
                  className="w-full h-11 font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #189aa1 0%, #0e7a80 100%)" }}
                >
                  {registerMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account&hellip;</>
                  ) : "Create Account"}
                </Button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">already have an account?</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => switchMode("password")}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                  Sign in with password
                </button>
                <button
                  onClick={() => switchMode("magic")}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Send me a magic link
                </button>
              </div>

              <p className="mt-5 text-xs text-gray-400 text-center leading-relaxed">
                By creating an account you agree to the{" "}
                <a href="https://www.allaboutultrasound.com/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Terms of Service</a>
                {" "}and{" "}
                <a href="https://www.allaboutultrasound.com/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Privacy Policy</a>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
