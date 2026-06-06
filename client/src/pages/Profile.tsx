/*
  Profile Page — All About Ultrasound™
  Allows logged-in users to edit their display name, email, bio, credentials,
  specialty, years of experience, location, website, and change their password.
  Also shows active subscriptions with links to manage them.
*/
import { useState, useEffect, useRef } from "react";
import {
  User, Mail, Edit3, Save, X, CheckCircle, ExternalLink, Award, Shield, Star,
  ClipboardList, Camera, Lock, MapPin, Globe, Briefcase, FileText, Eye, EyeOff,
  Clock, AlertCircle, RefreshCw, Bell, Heart,
} from "lucide-react";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const ROLE_CONFIG: Record<string, {
  label: string;
  description: string;
  color: string;
  icon: React.ElementType;
  manageUrl?: string;
  manageLabel?: string;
}> = {
  premium_user: {
    label: "Premium",
    description: "Access to TEE, ICE, Strain & Structural Heart Navigators and premium EchoAssist™ modules.",
    color: "#189aa1",
    icon: Star,
    manageUrl: "/premium",
    manageLabel: "Manage Premium Subscription",
  },
  diy_user: {
    label: "DIY Accreditation",
    description: "Access to the DIY Accreditation Tool™ for lab accreditation preparation.",
    color: "#f59e0b",
    icon: Award,
    manageUrl: "/premium",
    manageLabel: "Manage DIY Subscription",
  },
  diy_admin: {
    label: "Lab Admin",
    description: "Lab administrator access — manage staff, cases, and accreditation readiness.",
    color: "#f97316",
    icon: ClipboardList,
  },
  platform_admin: {
    label: "Platform Admin",
    description: "Full platform administration access.",
    color: "#a78bfa",
    icon: Shield,
  },
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AcceptedMime = (typeof ACCEPTED_TYPES)[number];

const SPECIALTY_OPTIONS = [
  "Adult Echocardiography",
  "Pediatric Echocardiography",
  "Fetal Echocardiography",
  "Congenital Heart Disease",
  "Structural Heart Disease",
  "Critical Care Echo",
  "Point-of-Care Ultrasound",
  "Vascular Ultrasound",
  "General Cardiology",
  "Cardiac Surgery",
  "Anesthesiology",
  "Emergency Medicine",
  "Other",
];

export default function Profile() {
  // Use direct query instead of useAuth() to get a stable data reference.
  // useAuth() wraps the query in useMemo with logoutMutation.isPending in deps,
  // which can produce a new `user` object reference on unrelated re-renders and
  // trigger the form-sync useEffect even while the user is actively editing.
  const { data: meData, isLoading: loading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const user = meData ?? null;
  const isAuthenticated = !!meData;
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<"info" | "password" | "notifications" | "interests" | "career">("info");

  // ── Career Network — candidate profile ──────────────────────────────────────
  const { data: candidateProfile, refetch: refetchCandidate } = trpc.careerNetwork.getMyCandidateProfile.useQuery(
    undefined, { enabled: !!user }
  );
  const saveCandidateMutation = trpc.careerNetwork.saveCandidateProfile.useMutation({
    onSuccess: () => { toast.success("Career profile saved!"); refetchCandidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const [careerHeadline, setCareerHeadline] = useState("");
  const [careerBio, setCareerBio] = useState("");
  const [careerLocation, setCareerLocation] = useState("");
  const [careerPhone, setCareerPhone] = useState("");
  const [careerLinkedin, setCareerLinkedin] = useState("");
  const [careerPortfolio, setCareerPortfolio] = useState("");
  const [careerYears, setCareerYears] = useState("");
  const [careerSpecialties, setCareerSpecialties] = useState("");
  const [careerCerts, setCareerCerts] = useState("");
  const [careerAvailability, setCareerAvailability] = useState("not_looking");
  const [careerSalary, setCareerSalary] = useState("");
  const [careerLocType, setCareerLocType] = useState("any");
  const [careerIsPublic, setCareerIsPublic] = useState(false);
  const [careerOpenToTravel, setCareerOpenToTravel] = useState(false);

  useEffect(() => {
    if (candidateProfile) {
      setCareerHeadline((candidateProfile as any).headline ?? "");
      setCareerBio((candidateProfile as any).bio ?? "");
      setCareerLocation((candidateProfile as any).location ?? "");
      setCareerPhone((candidateProfile as any).phone ?? "");
      setCareerLinkedin((candidateProfile as any).linkedinUrl ?? "");
      setCareerPortfolio((candidateProfile as any).portfolioUrl ?? "");
      setCareerYears((candidateProfile as any).yearsExperience?.toString() ?? "");
      const sp = (candidateProfile as any).specialties;
      setCareerSpecialties(Array.isArray(sp) ? sp.join(", ") : (typeof sp === "string" ? (sp.startsWith("[") ? JSON.parse(sp).join(", ") : sp) : ""));
      const ce = (candidateProfile as any).certifications;
      setCareerCerts(Array.isArray(ce) ? ce.join(", ") : (typeof ce === "string" ? (ce.startsWith("[") ? JSON.parse(ce).join(", ") : ce) : ""));
      setCareerAvailability((candidateProfile as any).availability ?? "not_looking");
      setCareerSalary((candidateProfile as any).desiredSalary ?? "");
      setCareerLocType((candidateProfile as any).desiredLocationType ?? "any");
      setCareerIsPublic((candidateProfile as any).isPublic ?? false);
      setCareerOpenToTravel((candidateProfile as any).openToTravel ?? false);
    }
  }, [candidateProfile]);

  // Interest preferences (new system)
  const userBrand = (user as any)?.brand as string | undefined;
  const { data: availableInterests, isLoading: interestsListLoading } = trpc.interests.getInterests.useQuery(
    { brand: userBrand },
    { enabled: !!user }
  );
  const { data: myInterestsData, isLoading: myInterestsLoading } = trpc.interests.getMyInterests.useQuery(
    undefined,
    { enabled: !!user }
  );
  const [selectedInterestIds, setSelectedInterestIds] = useState<number[]>([]);
  useEffect(() => {
    if (myInterestsData) {
      setSelectedInterestIds(myInterestsData.map((i: any) => i.id));
    }
  }, [myInterestsData]);
  const interestLoading = interestsListLoading || myInterestsLoading;
  const updateInterestsMutation = trpc.interests.updateMyInterests.useMutation({
    onSuccess: () => {
      toast.success("Interests saved");
      utils.interests.getMyInterests.invalidate();
    },
    onError: () => toast.error("Failed to save interests"),
  });

  // Notification preferences
  const { data: notifPrefs, isLoading: notifLoading } = trpc.quickfire.getNotificationPrefs.useQuery(
    undefined,
    { enabled: !!user }
  );
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifTimezone, setNotifTimezone] = useState("America/New_York");
  useEffect(() => {
    if (notifPrefs) {
      setNotifEnabled(notifPrefs.quickfireReminder);
      setNotifTimezone(notifPrefs.timezone ?? "America/New_York");
    }
  }, [notifPrefs]);
  const updateNotifPrefsMutation = trpc.quickfire.updateNotificationPrefs.useMutation({
    onSuccess: () => toast.success("Notification preferences saved"),
    onError: () => toast.error("Failed to save preferences"),
  });
  const [editMode, setEditMode] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [credentials, setCredentials] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [yearsExperience, setYearsExperience] = useState<string>("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  // Track the last user ID we synced from so we only reset form when the
  // actual user record changes, not on every re-render that produces a new
  // object reference from useAuth's useMemo.
  const syncedUserIdRef = useRef<number | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Email change verification state
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarDataUri, setAvatarDataUri] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState<AcceptedMime | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Auto-scroll to notifications section when URL has #notifications anchor
  useEffect(() => {
    if (window.location.hash === "#notifications") {
      setActiveSection("notifications");
      // Small delay to ensure the section is rendered before scrolling
      setTimeout(() => {
        const el = document.getElementById("notifications-section");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, []);

  // Sync form fields from user data ONLY when:
  // 1. We have a user and are NOT currently editing (so we don't clobber in-progress edits)
  // 2. The user's ID has changed since last sync (avoids resetting on every re-render
  //    caused by useAuth's useMemo returning a new object reference)
  const userId = (user as any)?.id ?? null;
  useEffect(() => {
    if (user && !editMode && userId !== null && userId !== syncedUserIdRef.current) {
      const u = user as any;
      setFirstName(u.firstName || "");
      setLastName(u.lastName || "");
      setDisplayName(u.displayName || u.name || "");
      setEmail(u.email || "");
      setBio(u.bio || "");
      setCredentials(u.credentials || "");
      setSpecialty(u.specialty || "");
      setYearsExperience(u.yearsExperience != null ? String(u.yearsExperience) : "");
      setLocation(u.location || "");
      setWebsite(u.website || "");
      setPendingEmail((u as any).pendingEmail ?? null);
      syncedUserIdRef.current = userId;
    }
  }, [userId, editMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a successful save, re-sync the form with the updated server data
  // (invalidate triggers a refetch; when it completes, force a re-sync by
  // clearing the cached ID so the effect runs again)
  const resyncAfterSave = () => {
    syncedUserIdRef.current = null;
  };

  const requestEmailChange = trpc.auth.requestEmailChange.useMutation({
    onSuccess: (data) => {
      toast.success(`Verification email sent to ${data.pendingEmail}. Check your inbox and click the link to confirm.`);
      setPendingEmail(data.pendingEmail);
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send verification email.");
    },
  });

  const cancelEmailChange = trpc.auth.cancelEmailChange.useMutation({
    onSuccess: () => {
      toast.success("Email change cancelled.");
      setPendingEmail(null);
      // Reset email field back to current email
      const u = user as any;
      setEmail(u.email || "");
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to cancel email change.");
    },
  });

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully.");
      setEditMode(false);
      resyncAfterSave(); // allow effect to re-sync once invalidate completes
      utils.auth.me.invalidate();
      // Invalidate community/cohort caches so discussion posts show updated profile
      utils.community.invalidate();
      utils.lmsCohortAdmin.invalidate();
      utils.lmsLearner.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update profile.");
    },
  });

  const hasPassword = !!(user as any)?.hasPassword;
  const setPasswordMutation = trpc.auth.setPassword.useMutation({
    onSuccess: () => {
      toast.success("Password set! You can now sign in with email and password.");
      setNewPassword("");
      setConfirmPassword("");
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to set password.");
    },
  });
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to change password.");
    },
  });

  const uploadAvatar = trpc.auth.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Profile photo updated.");
      setAvatarPreview(null);
      setAvatarDataUri(null);
      setAvatarMime(null);
      setAvatarUploading(false);
      utils.auth.me.invalidate();
      // Invalidate community/cohort caches so discussion posts show updated avatar
      utils.community.invalidate();
      utils.lmsCohortAdmin.invalidate();
      utils.lmsLearner.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload photo.");
      setAvatarUploading(false);
    },
  });

  if (!loading && !isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  if (loading || !user) {
    return (
      <Layout>
        <div className="container py-12 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#189aa1] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const u = user as any;
  const roles = (u.appRoles as string[] | undefined) ?? [];
  const PREMIUM_ROLE_SET = new Set(["premium_user", "diy_user", "diy_admin", "platform_admin"]);
  const isPremiumUser = u.isPremium === true || roles.some((r: string) => PREMIUM_ROLE_SET.has(r));
  // Filter out 'premium_user' Thinkific role since we now track isPremium from DB
  const activeSubscriptions = roles.filter((r: string) => ROLE_CONFIG[r] && r !== "premium_user");

  const handleSave = () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst) { toast.error("First name is required."); return; }
    if (!trimmedLast) { toast.error("Last name is required."); return; }

    const trimmedName = displayName.trim();
    if (!trimmedName) { toast.error("Display name cannot be empty."); return; }

    const yearsNum = yearsExperience !== "" ? parseInt(yearsExperience, 10) : null;
    if (yearsExperience !== "" && (isNaN(yearsNum!) || yearsNum! < 0 || yearsNum! > 60)) {
      toast.error("Years of experience must be a number between 0 and 60.");
      return;
    }

    const websiteTrimmed = website.trim();
    if (websiteTrimmed && !/^https?:\/\/.+/.test(websiteTrimmed)) {
      toast.error("Website must start with http:// or https://");
      return;
    }

    // If email changed, trigger verification flow instead of direct update
    const emailTrimmed = email.trim().toLowerCase();
    const currentEmail = (u.email || "").toLowerCase();
    const emailChanged = emailTrimmed !== currentEmail && emailTrimmed !== "";

    // Update all non-email fields — always send firstName, lastName, displayName so they
    // are never silently skipped due to stale comparison values in the session token.
    updateProfile.mutate({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      displayName: trimmedName,
      bio: bio.trim() || undefined,
      credentials: credentials.trim() || undefined,
      specialty: specialty || undefined,
      yearsExperience: yearsNum ?? undefined,
      location: location.trim() || undefined,
      website: websiteTrimmed || undefined,
    });

    // If email changed, separately trigger the verification email
    if (emailChanged) {
      requestEmailChange.mutate({ newEmail: emailTrimmed, origin: window.location.origin });
    }
  };

  const handleCancel = () => {
    setFirstName(u.firstName || "");
    setLastName(u.lastName || "");
    setDisplayName(u.displayName || u.name || "");
    setEmail(u.email || "");
    setBio(u.bio || "");
    setCredentials(u.credentials || "");
    setSpecialty(u.specialty || "");
    setYearsExperience(u.yearsExperience != null ? String(u.yearsExperience) : "");
    setLocation(u.location || "");
    setWebsite(u.website || "");
    setEditMode(false);
  };

  const handlePasswordChange = () => {
    if (!hasPassword) {
      if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
      if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
      setPasswordMutation.mutate({ newPassword });
    } else {
      if (!currentPassword) { toast.error("Please enter your current password."); return; }
      if (newPassword.length < 8) { toast.error("New password must be at least 8 characters."); return; }
      if (newPassword !== confirmPassword) { toast.error("New passwords do not match."); return; }
      changePassword.mutate({ currentPassword, newPassword });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type as AcceptedMime)) {
      toast.error("Please select a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUri = ev.target?.result as string;
      setAvatarPreview(dataUri);
      setAvatarDataUri(dataUri);
      setAvatarMime(file.type as AcceptedMime);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAvatarUpload = () => {
    if (!avatarDataUri || !avatarMime) return;
    setAvatarUploading(true);
    uploadAvatar.mutate({ dataUri: avatarDataUri, mimeType: avatarMime });
  };

  const handleAvatarCancel = () => {
    setAvatarPreview(null);
    setAvatarDataUri(null);
    setAvatarMime(null);
  };

  const currentAvatarUrl = u.avatarUrl as string | undefined;
  const displayAvatar = avatarPreview || currentAvatarUrl;
  const initials = (u.displayName || u.name || "?").charAt(0).toUpperCase();

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30 focus:border-[#189aa1] transition-colors";
  const readonlyClass = "w-full px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-600 border border-transparent";
  const labelClass = "block text-xs font-semibold text-gray-600 mb-1.5";

  return (
    <Layout>
      <div className="container py-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
            My Profile
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account details and subscriptions.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: avatar + subscriptions */}
          <div className="lg:col-span-1 space-y-5">
            {/* Avatar card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="relative group mb-3">
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Profile photo"
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-[#189aa1]/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}>
                    {initials}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Change photo"
                >
                  <Camera className="w-5 h-5 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {avatarPreview ? (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={handleAvatarUpload}
                    disabled={avatarUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: "#189aa1" }}
                  >
                    {avatarUploading ? (
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save Photo
                  </button>
                  <button
                    onClick={handleAvatarCancel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 text-xs text-[#189aa1] font-medium hover:underline"
                >
                  {currentAvatarUrl ? "Change photo" : "Add profile photo"}
                </button>
              )}

              <div className="mt-3 w-full">
                <p className="font-bold text-gray-800 text-sm">{u.displayName || u.name || "—"}</p>
                {u.credentials && (
                  <p className="text-xs text-[#189aa1] font-semibold mt-0.5">{u.credentials}</p>
                )}
                {u.specialty && (
                  <p className="text-xs text-gray-500 mt-0.5">{u.specialty}</p>
                )}
                {u.yearsExperience != null && (
                  <p className="text-xs text-gray-400 mt-0.5">{u.yearsExperience} yr{u.yearsExperience !== 1 ? "s" : ""} experience</p>
                )}
                {u.location && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3" /> {u.location}
                  </p>
                )}
                {u.website && (
                  <a href={u.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#189aa1] hover:underline mt-0.5 flex items-center justify-center gap-1">
                    <Globe className="w-3 h-3" /> Website
                  </a>
                )}
              </div>

              {u.bio && (
                <p className="mt-3 text-xs text-gray-500 leading-relaxed text-left w-full border-t border-gray-100 pt-3">
                  {u.bio}
                </p>
              )}
            </div>

            {/* Subscriptions card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                  My Subscriptions
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Your active access levels and plans.</p>
              </div>
              <div className="px-5 py-4">
                {!isPremiumUser && activeSubscriptions.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                      <Award className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 mb-1">No active subscriptions</p>
                    <p className="text-xs text-gray-400 mb-3">Unlock premium features and DIY accreditation tools.</p>
                    <a
                      href="/premium"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #189aa1, #4ad9e0)" }}
                    >
                      <Star className="w-3 h-3" />
                      Upgrade to Premium
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Premium Access (from DB isPremium flag) */}
                    {isPremiumUser && (
                      <div className="flex items-start gap-2.5 p-2.5 rounded-lg border"
                        style={{ borderColor: "#189aa130", background: "#189aa108" }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "#189aa120" }}>
                          <Star className="w-3.5 h-3.5" style={{ color: "#189aa1" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold" style={{ color: "#189aa1" }}>Premium Access</span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                              <CheckCircle className="w-2.5 h-2.5" /> Active
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">Full access to all All About Ultrasound™ premium features — $9.97/month.</p>
                          <a
                            href="/premium"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold hover:underline"
                            style={{ color: "#189aa1" }}
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Manage Premium Subscription
                          </a>
                        </div>
                      </div>
                    )}
                    {/* Other Thinkific role subscriptions */}
                    {activeSubscriptions.map((roleKey: string) => {
                      const config = ROLE_CONFIG[roleKey];
                      const Icon = config.icon;
                      return (
                        <div key={roleKey}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg border"
                          style={{ borderColor: config.color + "30", background: config.color + "08" }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: config.color + "20" }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-bold" style={{ color: config.color }}>{config.label}</span>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                                <CheckCircle className="w-2.5 h-2.5" /> Active
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">{config.description}</p>
                            {config.manageUrl && (
                              <a
                                href={config.manageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold hover:underline"
                                style={{ color: config.color }}
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                {config.manageLabel}
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: edit form */}
          <div className="lg:col-span-2 space-y-5">
            {/* Tab switcher */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setActiveSection("info")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${activeSection === "info" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <User className="w-3.5 h-3.5" />
                Personal Info
              </button>
              <button
                onClick={() => setActiveSection("password")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${activeSection === "password" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Lock className="w-3.5 h-3.5" />
                Password
              </button>
              <button
                onClick={() => setActiveSection("notifications")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${activeSection === "notifications" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Bell className="w-3.5 h-3.5" />
                Notifications
              </button>
              <button
                onClick={() => setActiveSection("interests")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${activeSection === "interests" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Heart className="w-3.5 h-3.5" />
                Interests
              </button>
              <button
                onClick={() => setActiveSection("career")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${activeSection === "career" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Career
              </button>
            </div>

            {/* Personal Info Section */}
            {activeSection === "info" && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                      Personal Information
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">Update your profile details and professional information.</p>
                  </div>
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#189aa1] border border-[#189aa1]/30 hover:bg-[#189aa1]/5 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={updateProfile.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                        style={{ background: "#189aa1" }}
                      >
                        {updateProfile.isPending ? (
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Save Changes
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* First + Last Name row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        <User className="w-3 h-3 inline mr-1" />
                        First Name <span className="text-red-500">*</span>
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={firstName}
                          onChange={e => setFirstName(e.target.value)}
                          className={inputClass}
                          placeholder="First name"
                          maxLength={100}
                          required
                        />
                      ) : (
                        <div className={readonlyClass}>{(u as any).firstName || "—"}</div>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>
                        <User className="w-3 h-3 inline mr-1" />
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={lastName}
                          onChange={e => setLastName(e.target.value)}
                          className={inputClass}
                          placeholder="Last name"
                          maxLength={100}
                          required
                        />
                      ) : (
                        <div className={readonlyClass}>{(u as any).lastName || "—"}</div>
                      )}
                    </div>
                  </div>

                  {/* Display Name + Email row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        <User className="w-3 h-3 inline mr-1" />
                        Display Name
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          className={inputClass}
                          placeholder="Your display name"
                          maxLength={100}
                        />
                      ) : (
                        <div className={readonlyClass}>{u.displayName || u.name || "—"}</div>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>
                        <Mail className="w-3 h-3 inline mr-1" />
                        Email Address
                      </label>
                      {editMode && !pendingEmail ? (
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className={inputClass}
                          placeholder="your@email.com"
                        />
                      ) : (
                        <div className={readonlyClass}>{u.email || "—"}</div>
                      )}
                      {/* Pending email verification banner */}
                      {pendingEmail && (
                        <div className="mt-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-amber-700">Verification pending</p>
                            <p className="text-xs text-amber-600 mt-0.5 break-all">
                              A confirmation link was sent to <span className="font-medium">{pendingEmail}</span>.
                              Your email will not change until you click the link.
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                onClick={() => requestEmailChange.mutate({ newEmail: pendingEmail, origin: window.location.origin })}
                                disabled={requestEmailChange.isPending}
                                className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-60"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                Resend
                              </button>
                              <span className="text-amber-300">·</span>
                              <button
                                onClick={() => cancelEmailChange.mutate()}
                                disabled={cancelEmailChange.isPending}
                                className="flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-700 disabled:opacity-60"
                              >
                                <X className="w-2.5 h-2.5" />
                                Cancel change
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Credentials + Specialty row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        <Award className="w-3 h-3 inline mr-1" />
                        Credentials
                        <span className="text-gray-400 font-normal ml-1">(e.g. RDCS, FASE)</span>
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={credentials}
                          onChange={e => setCredentials(e.target.value)}
                          className={inputClass}
                          placeholder="RDCS, FASE, RVT..."
                          maxLength={200}
                        />
                      ) : (
                        <div className={readonlyClass}>{u.credentials || "—"}</div>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>
                        <Briefcase className="w-3 h-3 inline mr-1" />
                        Specialty
                      </label>
                      {editMode ? (
                        <select
                          value={specialty}
                          onChange={e => setSpecialty(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select specialty...</option>
                          {SPECIALTY_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <div className={readonlyClass}>{u.specialty || "—"}</div>
                      )}
                    </div>
                  </div>

                  {/* Years Experience + Location row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        <Briefcase className="w-3 h-3 inline mr-1" />
                        Years of Experience
                      </label>
                      {editMode ? (
                        <input
                          type="number"
                          value={yearsExperience}
                          onChange={e => setYearsExperience(e.target.value)}
                          className={inputClass}
                          placeholder="e.g. 5"
                          min={0}
                          max={60}
                        />
                      ) : (
                        <div className={readonlyClass}>
                          {u.yearsExperience != null ? `${u.yearsExperience} year${u.yearsExperience !== 1 ? "s" : ""}` : "—"}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>
                        <MapPin className="w-3 h-3 inline mr-1" />
                        Location
                      </label>
                      {editMode ? (
                        <input
                          type="text"
                          value={location}
                          onChange={e => setLocation(e.target.value)}
                          className={inputClass}
                          placeholder="City, State or Country"
                          maxLength={100}
                        />
                      ) : (
                        <div className={readonlyClass}>{u.location || "—"}</div>
                      )}
                    </div>
                  </div>

                  {/* Website */}
                  <div>
                    <label className={labelClass}>
                      <Globe className="w-3 h-3 inline mr-1" />
                      Website
                    </label>
                    {editMode ? (
                      <input
                        type="url"
                        value={website}
                        onChange={e => setWebsite(e.target.value)}
                        className={inputClass}
                        placeholder="https://yourwebsite.com"
                        maxLength={200}
                      />
                    ) : (
                      <div className={readonlyClass}>
                        {u.website ? (
                          <a href={u.website} target="_blank" rel="noopener noreferrer"
                            className="text-[#189aa1] hover:underline flex items-center gap-1">
                            {u.website}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : "—"}
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  <div>
                    <label className={labelClass}>
                      <FileText className="w-3 h-3 inline mr-1" />
                      Bio
                      <span className="text-gray-400 font-normal ml-1">(max 1000 characters)</span>
                    </label>
                    {editMode ? (
                      <div>
                        <textarea
                          value={bio}
                          onChange={e => setBio(e.target.value)}
                          className={`${inputClass} resize-none`}
                          rows={4}
                          placeholder="Tell others about your background, experience, and interests in echocardiography..."
                          maxLength={1000}
                        />
                        <p className="text-right text-xs text-gray-400 mt-1">{bio.length}/1000</p>
                      </div>
                    ) : (
                      <div className={`${readonlyClass} min-h-[80px] whitespace-pre-wrap`}>
                        {u.bio || <span className="text-gray-400 italic">No bio added yet.</span>}
                      </div>
                    )}
                  </div>

                  {/* Account info (read-only) */}
                  <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Account ID</label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-400 font-mono">
                        #{u.id}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Member Since</label>
                      <div className="px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Password Section */}
            {activeSection === "password" && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    {hasPassword ? "Change Password" : "Set Password"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {hasPassword ? "Update your account password. Minimum 8 characters." : "Add a password so you can sign in with email and password."}
                  </p>
                </div>

                <div className="px-6 py-5 space-y-4 max-w-md">
                  {hasPassword && (
                  <div>
                    <label className={labelClass}>Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className={`${inputClass} pr-10`}
                        placeholder="Enter current password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  )}

                  <div>
                    <label className={labelClass}>New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className={`${inputClass} pr-10`}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPassword && newPassword.length < 8 && (
                      <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters.</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={`${inputClass} pr-10`}
                        placeholder="Repeat new password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handlePasswordChange}
                      disabled={
                        (hasPassword ? changePassword.isPending : setPasswordMutation.isPending) ||
                        (hasPassword && !currentPassword) ||
                        !newPassword || !confirmPassword
                      }
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: "#189aa1" }}
                    >
                      {(hasPassword ? changePassword.isPending : setPasswordMutation.isPending) ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      {(hasPassword ? changePassword.isPending : setPasswordMutation.isPending)
                        ? "Saving..."
                        : hasPassword ? "Update Password" : "Set Password"}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      Forgot your current password?{" "}
                      <a href="/forgot-password" className="text-[#189aa1] hover:underline font-medium">
                        Reset via email
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Interests Section */}
            {activeSection === "interests" && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    Content Interests
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select the clinical areas you are most interested in. This helps us send you relevant updates, resources, and announcements.
                  </p>
                </div>
                <div className="p-6">
                  {interestLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading interests...
                    </div>
                  ) : (
                    <>
                      {(!availableInterests || availableInterests.length === 0) ? (
                        <p className="text-sm text-gray-400">No interests available for your account.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-6">
                          {availableInterests.map((interest: any) => {
                            const isSelected = selectedInterestIds.includes(interest.id);
                            return (
                              <button
                                key={interest.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInterestIds(prev =>
                                    isSelected
                                      ? prev.filter(id => id !== interest.id)
                                      : [...prev, interest.id]
                                  );
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                                  isSelected
                                    ? "border-[#189aa1] bg-[#189aa1] text-white"
                                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#189aa1] hover:text-[#189aa1]"
                                }`}
                              >
                                {interest.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                          {selectedInterestIds.length} interest{selectedInterestIds.length !== 1 ? "s" : ""} selected
                        </p>
                        <button
                          onClick={() => updateInterestsMutation.mutate({ interestIds: selectedInterestIds })}
                          disabled={updateInterestsMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ background: "#189aa1" }}
                        >
                          {updateInterestsMutation.isPending ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Save Interests
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === "notifications" && (
              <div id="notifications-section" className="bg-white rounded-xl border border-gray-100 shadow-sm"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                    Notification Preferences
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Control when All About Ultrasound™ sends you email reminders.</p>
                </div>
                <div className="p-6 space-y-6">
                  {notifLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading preferences...
                    </div>
                  ) : (
                    <>
                      {/* Daily Challenge Reminder Toggle */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Bell className="w-4 h-4" style={{ color: "#189aa1" }} />
                            <span className="text-sm font-semibold text-gray-800">Daily Challenge Reminder</span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            Receive a daily email reminder if you haven't completed your Daily Challenge session.
                            Includes your current streak so you never lose momentum.
                          </p>
                        </div>
                        <button
                          onClick={() => setNotifEnabled((v) => !v)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                            notifEnabled ? "bg-[#189aa1]" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              notifEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Timezone Selector */}
                      {notifEnabled && (
                        <div className="flex items-start gap-4 pl-6">
                          <div className="flex items-center gap-2 mt-1.5">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">Your timezone</span>
                          </div>
                          <div className="flex-1">
                            <select
                              value={notifTimezone}
                              onChange={(e) => setNotifTimezone(e.target.value)}
                              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#189aa1] bg-white"
                            >
                              <optgroup label="North America">
                                <option value="America/New_York">Eastern Time (ET) — New York</option>
                                <option value="America/Chicago">Central Time (CT) — Chicago</option>
                                <option value="America/Denver">Mountain Time (MT) — Denver</option>
                                <option value="America/Phoenix">Mountain Time, no DST — Phoenix</option>
                                <option value="America/Los_Angeles">Pacific Time (PT) — Los Angeles</option>
                                <option value="America/Anchorage">Alaska Time — Anchorage</option>
                                <option value="Pacific/Honolulu">Hawaii Time — Honolulu</option>
                                <option value="America/Toronto">Eastern Time — Toronto</option>
                                <option value="America/Vancouver">Pacific Time — Vancouver</option>
                              </optgroup>
                              <optgroup label="Europe">
                                <option value="Europe/London">GMT/BST — London</option>
                                <option value="Europe/Paris">CET/CEST — Paris</option>
                                <option value="Europe/Berlin">CET/CEST — Berlin</option>
                                <option value="Europe/Amsterdam">CET/CEST — Amsterdam</option>
                                <option value="Europe/Stockholm">CET/CEST — Stockholm</option>
                                <option value="Europe/Helsinki">EET/EEST — Helsinki</option>
                                <option value="Europe/Athens">EET/EEST — Athens</option>
                                <option value="Europe/Istanbul">TRT — Istanbul</option>
                                <option value="Europe/Moscow">MSK — Moscow</option>
                              </optgroup>
                              <optgroup label="Asia / Pacific">
                                <option value="Asia/Dubai">GST — Dubai</option>
                                <option value="Asia/Karachi">PKT — Karachi</option>
                                <option value="Asia/Kolkata">IST — India</option>
                                <option value="Asia/Dhaka">BST — Dhaka</option>
                                <option value="Asia/Bangkok">ICT — Bangkok</option>
                                <option value="Asia/Singapore">SGT — Singapore</option>
                                <option value="Asia/Tokyo">JST — Tokyo</option>
                                <option value="Asia/Seoul">KST — Seoul</option>
                                <option value="Asia/Shanghai">CST — Shanghai</option>
                                <option value="Australia/Sydney">AEST/AEDT — Sydney</option>
                                <option value="Australia/Melbourne">AEST/AEDT — Melbourne</option>
                                <option value="Pacific/Auckland">NZST/NZDT — Auckland</option>
                              </optgroup>
                              <optgroup label="Middle East / Africa">
                                <option value="Africa/Cairo">EET — Cairo</option>
                                <option value="Africa/Johannesburg">SAST — Johannesburg</option>
                                <option value="Asia/Riyadh">AST — Riyadh</option>
                                <option value="Asia/Jerusalem">IST/IDT — Jerusalem</option>
                              </optgroup>
                              <optgroup label="Latin America">
                                <option value="America/Sao_Paulo">BRT/BRST — São Paulo</option>
                                <option value="America/Argentina/Buenos_Aires">ART — Buenos Aires</option>
                                <option value="America/Mexico_City">CST/CDT — Mexico City</option>
                                <option value="America/Bogota">COT — Bogotá</option>
                              </optgroup>
                            </select>
                            <p className="text-xs text-gray-400 mt-1">Notifications will be sent at 9:00 AM in your selected timezone.</p>
                          </div>
                        </div>
                      )}

                      {/* Save Button */}
                      <div className="pt-2 border-t border-gray-100 flex justify-end">
                        <button
                          onClick={() =>
                            updateNotifPrefsMutation.mutate({
                              quickfireReminder: notifEnabled,
                              reminderTime: "09:00",
                              timezone: notifTimezone,
                            })
                          }
                          disabled={updateNotifPrefsMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ background: "#189aa1" }}
                        >
                          {updateNotifPrefsMutation.isPending ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Save Preferences
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Career Network Section */}
      {activeSection === "career" && (
        <div className="container py-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>Career Network Profile</h2>
                <p className="text-xs text-gray-400 mt-0.5">Opt in to be discoverable by employers. Your profile is private by default.</p>
              </div>
              <div className="px-6 py-5 space-y-5">

                {/* Opt-in toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-[#189aa1]/5 border border-[#189aa1]/20">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Make my profile visible to employers</p>
                    <p className="text-xs text-gray-500 mt-0.5">Only employers with an active subscription can browse candidate profiles.</p>
                  </div>
                  <button
                    onClick={() => setCareerIsPublic(!careerIsPublic)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      careerIsPublic ? "bg-[#189aa1]" : "bg-gray-300"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      careerIsPublic ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                {/* Travel opt-in */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Open to travel contracts</p>
                    <p className="text-xs text-gray-500 mt-0.5">Let travel staffing agencies and hospitals know you're interested in travel assignments.</p>
                  </div>
                  <button
                    onClick={() => setCareerOpenToTravel(!careerOpenToTravel)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      careerOpenToTravel ? "bg-amber-500" : "bg-gray-300"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      careerOpenToTravel ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                {/* Professional headline */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Professional Headline</label>
                  <input
                    type="text" maxLength={300} value={careerHeadline} onChange={e => setCareerHeadline(e.target.value)}
                    placeholder="e.g. Registered Cardiac Sonographer | Adult Echo Specialist"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Professional Summary</label>
                  <textarea
                    rows={3} value={careerBio} onChange={e => setCareerBio(e.target.value)}
                    placeholder="Brief summary of your experience and career goals..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30 resize-none"
                  />
                </div>

                {/* Location + Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Location (City, State)</label>
                    <input
                      type="text" value={careerLocation} onChange={e => setCareerLocation(e.target.value)}
                      placeholder="e.g. Dallas, TX"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Phone (optional)</label>
                    <input
                      type="tel" value={careerPhone} onChange={e => setCareerPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                    />
                  </div>
                </div>

                {/* Years + Availability */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Years of Experience</label>
                    <input
                      type="number" min={0} max={60} value={careerYears} onChange={e => setCareerYears(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Availability</label>
                    <select value={careerAvailability} onChange={e => setCareerAvailability(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30 bg-white">
                      <option value="not_looking">Not currently looking</option>
                      <option value="immediately">Immediately</option>
                      <option value="2_weeks">Within 2 weeks</option>
                      <option value="1_month">Within 1 month</option>
                      <option value="3_months">Within 3 months</option>
                    </select>
                  </div>
                </div>

                {/* Desired location type + salary */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Preferred Work Setting</label>
                    <select value={careerLocType} onChange={e => setCareerLocType(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30 bg-white">
                      <option value="any">Any</option>
                      <option value="onsite">On-site</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Desired Salary / Rate</label>
                    <input
                      type="text" value={careerSalary} onChange={e => setCareerSalary(e.target.value)}
                      placeholder="e.g. $80,000/yr or $45/hr"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                    />
                  </div>
                </div>

                {/* Specialties */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Specialties <span className="font-normal text-gray-400">(comma-separated)</span></label>
                  <input
                    type="text" value={careerSpecialties} onChange={e => setCareerSpecialties(e.target.value)}
                    placeholder="e.g. Adult Echo, TEE, Structural Heart, Vascular"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                  />
                </div>

                {/* Certifications */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Certifications <span className="font-normal text-gray-400">(comma-separated)</span></label>
                  <input
                    type="text" value={careerCerts} onChange={e => setCareerCerts(e.target.value)}
                    placeholder="e.g. RCS, RDCS, FASE, CCI"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                  />
                </div>

                {/* LinkedIn + Portfolio */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">LinkedIn URL</label>
                    <input
                      type="url" value={careerLinkedin} onChange={e => setCareerLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Portfolio URL</label>
                    <input
                      type="url" value={careerPortfolio} onChange={e => setCareerPortfolio(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                    />
                  </div>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      saveCandidateMutation.mutate({
                        headline: careerHeadline || undefined,
                        bio: careerBio || undefined,
                        location: careerLocation || undefined,
                        phone: careerPhone || undefined,
                        linkedinUrl: careerLinkedin || undefined,
                        portfolioUrl: careerPortfolio || undefined,
                        yearsExperience: careerYears ? parseInt(careerYears) : undefined,
                        specialties: careerSpecialties ? careerSpecialties.split(",").map(s => s.trim()).filter(Boolean) : undefined,
                        certifications: careerCerts ? careerCerts.split(",").map(s => s.trim()).filter(Boolean) : undefined,
                        availability: careerAvailability as any,
                        desiredSalary: careerSalary || undefined,
                        desiredLocationType: careerLocType as any,
                        isPublic: careerIsPublic,
                        openToTravel: careerOpenToTravel,
                      });
                    }}
                    disabled={saveCandidateMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-[#189aa1] text-white text-xs font-semibold rounded-lg hover:bg-[#147f85] transition-colors disabled:opacity-60"
                  >
                    {saveCandidateMutation.isPending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save Career Profile
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
