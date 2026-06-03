/**
 * formEmbedWidgetTypes.ts — embed widget configuration schema & defaults.
 */

export type FormEmbedDisplayType = "inline" | "popup" | "slide_in";

export type EmbedOpenFrequency = "always" | "once_per_session" | "once_per_user";

export type EmbedSubmitBehavior =
  | "close"
  | "show_success"
  | "redirect"
  | "keep_open"
  | "replace_confirmation";

export interface EmbedTriggerConfig {
  openImmediately: boolean;
  delaySeconds: number;
  scrollPercent: number;
  buttonClick: boolean;
  buttonSelector: string;
  linkClick: boolean;
  linkSelector: string;
  customElementSelector: string;
  exitIntent: boolean;
  inactivitySeconds: number;
  multiPageViews: number;
  openFrequency: EmbedOpenFrequency;
}

export interface FormEmbedInlineSettings {
  width: string;
  maxWidth: string;
  autoHeight: boolean;
  responsive: boolean;
  themeSelection: "form" | "light" | "dark" | "minimal";
  hidePlatformBranding: boolean;
  containerPadding: string;
  borderRadius: string;
}

export interface FormEmbedPopupSettings {
  triggers: EmbedTriggerConfig;
  width: string;
  height: string;
  overlayColor: string;
  overlayOpacity: number;
  borderRadius: string;
  shadow: boolean;
  showCloseButton: boolean;
  clickOutsideToClose: boolean;
  onSubmit: EmbedSubmitBehavior;
  triggerButtonLabel: string;
}

export interface FormEmbedSlideInSettings {
  position: "right" | "left" | "bottom";
  triggers: EmbedTriggerConfig;
  panelWidth: string;
  panelHeight: string;
  floatingTabLabel: string;
  floatingButtonLabel: string;
  minimizedState: boolean;
  borderRadius: string;
  shadow: boolean;
  onSubmit: EmbedSubmitBehavior;
}

export interface FormEmbedAnalyticsSettings {
  trackLoads: boolean;
  trackViews: boolean;
  trackOpens: boolean;
  trackCloses: boolean;
  trackFormStarted: boolean;
  trackConversions: boolean;
}

export interface FormEmbedWidgetSettings {
  inline: FormEmbedInlineSettings;
  popup: FormEmbedPopupSettings;
  slideIn: FormEmbedSlideInSettings;
  analytics: FormEmbedAnalyticsSettings;
}

export const DEFAULT_EMBED_TRIGGERS: EmbedTriggerConfig = {
  openImmediately: false,
  delaySeconds: 5,
  scrollPercent: 50,
  buttonClick: true,
  buttonSelector: "",
  linkClick: false,
  linkSelector: "",
  customElementSelector: "",
  exitIntent: false,
  inactivitySeconds: 30,
  multiPageViews: 0,
  openFrequency: "once_per_session",
};

export function defaultEmbedWidgetSettings(): FormEmbedWidgetSettings {
  return {
    inline: {
      width: "100%",
      maxWidth: "720px",
      autoHeight: true,
      responsive: true,
      themeSelection: "form",
      hidePlatformBranding: false,
      containerPadding: "0",
      borderRadius: "12px",
    },
    popup: {
      triggers: { ...DEFAULT_EMBED_TRIGGERS, openImmediately: false, delaySeconds: 3 },
      width: "640px",
      height: "80vh",
      overlayColor: "#000000",
      overlayOpacity: 0.55,
      borderRadius: "16px",
      shadow: true,
      showCloseButton: true,
      clickOutsideToClose: true,
      onSubmit: "show_success",
      triggerButtonLabel: "Open Form",
    },
    slideIn: {
      position: "right",
      triggers: { ...DEFAULT_EMBED_TRIGGERS, buttonClick: false },
      panelWidth: "420px",
      panelHeight: "100vh",
      floatingTabLabel: "Feedback",
      floatingButtonLabel: "Open Form",
      minimizedState: true,
      borderRadius: "12px 0 0 12px",
      shadow: true,
      onSubmit: "show_success",
    },
    analytics: {
      trackLoads: true,
      trackViews: true,
      trackOpens: true,
      trackCloses: true,
      trackFormStarted: true,
      trackConversions: true,
    },
  };
}

export function parseEmbedSettings(json: string | null | undefined): FormEmbedWidgetSettings {
  if (!json) return defaultEmbedWidgetSettings();
  try {
    const parsed = JSON.parse(json) as Partial<FormEmbedWidgetSettings>;
    const defaults = defaultEmbedWidgetSettings();
    return {
      inline: { ...defaults.inline, ...parsed.inline },
      popup: {
        ...defaults.popup,
        ...parsed.popup,
        triggers: { ...defaults.popup.triggers, ...parsed.popup?.triggers },
      },
      slideIn: {
        ...defaults.slideIn,
        ...parsed.slideIn,
        triggers: { ...defaults.slideIn.triggers, ...parsed.slideIn?.triggers },
      },
      analytics: { ...defaults.analytics, ...parsed.analytics },
    };
  } catch {
    return defaultEmbedWidgetSettings();
  }
}

export function parseAllowedDomains(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}
