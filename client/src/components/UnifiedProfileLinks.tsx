import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  DollarSign,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { APP_URL, LEARN_APP_URL } from "@/hooks/useSubdomain";
import { buildStudentDashboardUrl } from "@shared/studentDashboardUrls";

type UnifiedProfileLinksProps = {
  user: any;
  onNavigate?: () => void;
  className?: string;
  additionalItems?: ReactNode;
};

const ITEM_CLASS = "flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-teal-700";
const SUB_ITEM_CLASS = "flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-teal-50 hover:text-teal-700";

function AccountLink({ href, icon: Icon, children, onNavigate, className = ITEM_CLASS }: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  onNavigate?: () => void;
  className?: string;
}) {
  return <a href={href} onClick={onNavigate} className={className}><Icon className="h-3.5 w-3.5 shrink-0 text-teal-600" />{children}</a>;
}

/**
 * The canonical signed-in profile navigation used by Learn and each connected
 * app. Learning account choices always return to Learn; the event dashboard
 * remains a distinct destination and is visible only to eligible participants.
 */
export function UnifiedProfileLinks({ user, onNavigate, className, additionalItems }: UnifiedProfileLinksProps) {
  const roles: string[] = user?.appRoles ?? [];
  const isAdmin = user?.role === "admin";
  const isPlatformAdmin = isAdmin || roles.includes("platform_admin") || roles.includes("platform_owner") || roles.includes("platform_moderator");
  const hasEducationManagement = isPlatformAdmin || roles.includes("education_manager") || roles.includes("education_admin");
  const hasDiyAccess = isPlatformAdmin || roles.includes("diy_user") || roles.includes("diy_admin");
  const hasAccreditationManager = isPlatformAdmin || roles.includes("accreditation_manager");
  const registrations = trpc.ultrasoundExpo.myDashboard.useQuery(undefined, { enabled: !!user });
  const partnerAccess = trpc.vendorPortal.myAccess.useQuery(undefined, { enabled: !!user });
  const hasUltrasoundExpoAccess = isPlatformAdmin
    || (registrations.data?.length ?? 0) > 0
    || !!partnerAccess.data?.approved?.ultrasoundExpo;

  const learnDashboard = buildStudentDashboardUrl({ origin: LEARN_APP_URL });
  const learnContent = buildStudentDashboardUrl({ origin: LEARN_APP_URL, tab: "content" });
  const learnSubscriptions = buildStudentDashboardUrl({ origin: LEARN_APP_URL, tab: "subscriptions" });

  return <div className={className} data-profile-navigation="learn-canonical">
    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Profile</div>
    <AccountLink href={learnDashboard} icon={LayoutDashboard} onNavigate={onNavigate}>My Dashboard</AccountLink>
    <AccountLink href={learnContent} icon={BookOpen} onNavigate={onNavigate}>My Content</AccountLink>
    <AccountLink href={learnSubscriptions} icon={CreditCard} onNavigate={onNavigate}>My Subscriptions</AccountLink>
    {hasUltrasoundExpoAccess && <AccountLink href="https://ultrasoundexpo.com/expo-dashboard" icon={CalendarDays} onNavigate={onNavigate}>UltrasoundExpo™</AccountLink>}
    {additionalItems}

    {hasEducationManagement && <section className="border-t border-gray-100 py-1.5">
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Educator Platform</div>
      <AccountLink href={`${APP_URL}/educator-assist`} icon={GraduationCap} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>EducatorAssist™</AccountLink>
    </section>}

    {(hasDiyAccess || hasAccreditationManager) && <section className="border-t border-gray-100 py-1.5">
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Accreditation</div>
      {hasDiyAccess && <>
        <AccountLink href={`${APP_URL}/lab-admin`} icon={Building2} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Lab Admin Portal</AccountLink>
        <AccountLink href={`${APP_URL}/diy-member`} icon={Users} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Member Portal</AccountLink>
      </>}
      {hasAccreditationManager && <AccountLink href={`${APP_URL}/accreditation-manager`} icon={ClipboardList} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Accreditation Manager</AccountLink>}
    </section>}

    {isPlatformAdmin && <section className="border-t border-gray-100 py-1.5">
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Admin</div>
      <AccountLink href={`${APP_URL}/platform-admin`} icon={ShieldCheck} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Platform Admin</AccountLink>
      <AccountLink href={`${LEARN_APP_URL}/admin/lms`} icon={Settings} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>LMS Admin</AccountLink>
      <AccountLink href={`${APP_URL}/admin/ultrasound-expo`} icon={CalendarDays} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>UltrasoundExpo™ Management</AccountLink>
      <AccountLink href={`${APP_URL}/admin/media-repository`} icon={FolderOpen} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Media Repository</AccountLink>
      <AccountLink href={`${LEARN_APP_URL}/admin/lesson-comments`} icon={MessageSquare} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Lesson Comments</AccountLink>
      <AccountLink href={`${APP_URL}/admin/community`} icon={Users} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Community Admin</AccountLink>
    </section>}

    {roles.includes("affiliate") && <section className="border-t border-gray-100 py-1.5"><div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Affiliate</div><AccountLink href="https://members.allaboutultrasound.com/affiliate-dashboard" icon={DollarSign} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Affiliate Dashboard</AccountLink></section>}
    {roles.includes("instructor") && <section className="border-t border-gray-100 py-1.5"><div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Instructor</div><AccountLink href="https://members.allaboutultrasound.com/instructor-portal" icon={BookOpen} onNavigate={onNavigate} className={SUB_ITEM_CLASS}>Instructor Portal</AccountLink></section>}
  </div>;
}
