export type CheckoutEntityType = "course" | "download" | "physical" | "webinar" | "membership";

export interface CheckoutPreviewMeta {
  courseTitle: string;
  courseSubtitle: string | null;
  courseDescription: string | null;
  courseThumbnail: string | null;
  primaryColor: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: string;
  playerTheme: string;
  termsUrl: string;
  privacyUrl: string;
  checkoutTermsText: string;
  checkoutTermsLink1Text: string;
  checkoutTermsLink1Url: string;
  checkoutTermsLink2Text: string;
  checkoutTermsLink2Url: string;
  productName: string;
  displayPrice: number;
  pricingType: string;
  isSubscription: boolean;
  billingLabel: string | null;
  currency: string;
  minSeats: number | null;
  discountPercent: number | null;
}

const DEFAULT_TERMS = {
  checkoutTermsText: "I have reviewed and agree to the",
  checkoutTermsLink1Text: "Terms of Service",
  checkoutTermsLink1Url: "https://www.allaboutultrasound.com/terms.html",
  checkoutTermsLink2Text: "Privacy Policy",
  checkoutTermsLink2Url: "https://www.allaboutultrasound.com/privacy-policy.html",
};

const DEFAULT_THEME = {
  primaryColor: "#189aa1",
  accentColor: "#4ad9e0",
  gradientFrom: "#189aa1",
  gradientTo: "#4ad9e0",
  gradientDirection: "135deg",
  playerTheme: "light",
};

function numberOrZero(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePricingOptions(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
  } catch {
    return [];
  }
}

function termsFor(item: Record<string, unknown>): Pick<
  CheckoutPreviewMeta,
  "termsUrl" | "privacyUrl" | "checkoutTermsText" | "checkoutTermsLink1Text" | "checkoutTermsLink1Url" | "checkoutTermsLink2Text" | "checkoutTermsLink2Url"
> {
  const link1Url = typeof item.purchaseTermsLinkUrl1 === "string" && item.purchaseTermsLinkUrl1.trim()
    ? item.purchaseTermsLinkUrl1.trim()
    : DEFAULT_TERMS.checkoutTermsLink1Url;
  const link2Url = typeof item.purchaseTermsLinkUrl2 === "string" && item.purchaseTermsLinkUrl2.trim()
    ? item.purchaseTermsLinkUrl2.trim()
    : DEFAULT_TERMS.checkoutTermsLink2Url;

  return {
    termsUrl: link1Url,
    privacyUrl: link2Url,
    checkoutTermsText: typeof item.purchaseTermsText === "string" && item.purchaseTermsText.trim()
      ? item.purchaseTermsText.trim()
      : DEFAULT_TERMS.checkoutTermsText,
    checkoutTermsLink1Text: typeof item.purchaseTermsLinkText1 === "string" && item.purchaseTermsLinkText1.trim()
      ? item.purchaseTermsLinkText1.trim()
      : DEFAULT_TERMS.checkoutTermsLink1Text,
    checkoutTermsLink1Url: link1Url,
    checkoutTermsLink2Text: typeof item.purchaseTermsLinkText2 === "string" && item.purchaseTermsLinkText2.trim()
      ? item.purchaseTermsLinkText2.trim()
      : DEFAULT_TERMS.checkoutTermsLink2Text,
    checkoutTermsLink2Url: link2Url,
  };
}

function basePreview(item: Record<string, unknown>, overrides: Partial<CheckoutPreviewMeta>): CheckoutPreviewMeta {
  const title = String(item.title ?? "");
  return {
    courseTitle: title,
    courseSubtitle: typeof item.subtitle === "string" ? item.subtitle : null,
    courseDescription: typeof item.description === "string" ? item.description : null,
    courseThumbnail: typeof item.coverImageUrl === "string"
      ? item.coverImageUrl
      : typeof item.thumbnailUrl === "string"
        ? item.thumbnailUrl
        : typeof item.coverImage === "string"
          ? item.coverImage
          : null,
    primaryColor: typeof item.primaryColor === "string" && item.primaryColor ? item.primaryColor : DEFAULT_THEME.primaryColor,
    accentColor: typeof item.accentColor === "string" && item.accentColor ? item.accentColor : DEFAULT_THEME.accentColor,
    gradientFrom: typeof item.gradientFrom === "string" && item.gradientFrom ? item.gradientFrom : DEFAULT_THEME.gradientFrom,
    gradientTo: typeof item.gradientTo === "string" && item.gradientTo ? item.gradientTo : DEFAULT_THEME.gradientTo,
    gradientDirection: typeof item.gradientDirection === "string" && item.gradientDirection ? item.gradientDirection : DEFAULT_THEME.gradientDirection,
    playerTheme: typeof item.playerTheme === "string" && item.playerTheme ? item.playerTheme : DEFAULT_THEME.playerTheme,
    ...termsFor(item),
    productName: title,
    displayPrice: 0,
    pricingType: "one_time",
    isSubscription: false,
    billingLabel: null,
    currency: typeof item.currency === "string" && item.currency ? item.currency : "usd",
    minSeats: null,
    discountPercent: null,
    ...overrides,
  };
}

function courseBillingLabel(pricingType: string, item: Record<string, unknown>, price: number): string | null {
  if (pricingType === "subscription") {
    const labels: Record<string, string> = {
      monthly: "month",
      quarterly: "3 months",
      annual: "year",
    };
    const interval = labels[String(item.subscriptionInterval ?? "monthly")] ?? String(item.subscriptionInterval ?? "month");
    return `$${price.toFixed(2)} / ${interval} — recurring, cancel anytime`;
  }
  if (pricingType === "payment_plan") {
    const installmentAmount = numberOrZero(item.installmentAmount) || price;
    const installmentCount = numberOrZero(item.installmentCount);
    return installmentCount > 0 ? `${installmentCount} payments of $${installmentAmount.toFixed(2)}` : null;
  }
  return null;
}

export function buildPublicCheckoutPreview(input: {
  entityType: CheckoutEntityType;
  course?: Record<string, unknown> | null;
  download?: Record<string, unknown> | null;
  physical?: Record<string, unknown> | null;
  webinar?: Record<string, unknown> | null;
  membership?: Record<string, unknown> | null;
  pricingOptionId?: number;
  teamTierId?: number;
}): CheckoutPreviewMeta | null {
  if (input.entityType === "course") {
    const course = input.course;
    if (!course) return null;

    const teamTier = input.teamTierId
      ? (Array.isArray(course.teamTiers) ? course.teamTiers : []).find((tier: any) => Number(tier?.id) === input.teamTierId) as Record<string, unknown> | undefined
      : undefined;
    if (teamTier) {
      const discountPercent = numberOrZero(teamTier.discountPercent);
      const primaryPrice = numberOrZero(course.price);
      const perSeatPrice = Math.max(0.5, Math.round(primaryPrice * (1 - discountPercent / 100) * 100) / 100);
      const minSeats = Math.max(1, numberOrZero(teamTier.minSeats));
      return basePreview(course, {
        productName: `${String(course.title ?? "")} — Team (${minSeats}+ seats, ${discountPercent}% off)`,
        displayPrice: perSeatPrice,
        pricingType: "one_time",
        minSeats,
        discountPercent,
        billingLabel: `$${perSeatPrice.toFixed(2)}/seat × ${minSeats} seats minimum`,
      });
    }

    const pricingOption = input.pricingOptionId
      ? (Array.isArray(course.pricingOptions) ? course.pricingOptions : []).find((option: any) => Number(option?.id) === input.pricingOptionId) as Record<string, unknown> | undefined
      : undefined;
    const pricingType = String(pricingOption?.pricingType ?? (course.isFree ? "free" : course.pricingType ?? "one_time"));
    const price = numberOrZero(pricingOption?.price ?? course.price);
    const pricingSource = pricingOption ? { ...course, ...pricingOption } : course;
    return basePreview(course, {
      productName: typeof pricingOption?.label === "string" && pricingOption.label.trim()
        ? `${String(course.title ?? "")} — ${pricingOption.label.trim()}`
        : String(course.title ?? ""),
      displayPrice: pricingType === "free" ? 0 : price,
      pricingType,
      isSubscription: pricingType === "subscription" || pricingType === "payment_plan",
      billingLabel: courseBillingLabel(pricingType, pricingSource, price),
    });
  }

  if (input.entityType === "download") {
    const product = input.download;
    if (!product) return null;
    const isFree = Boolean(product.isFree) || numberOrZero(product.price) === 0;
    return basePreview(product, {
      displayPrice: isFree ? 0 : numberOrZero(product.price),
      pricingType: isFree ? "free" : "one_time",
    });
  }

  if (input.entityType === "physical") {
    const product = input.physical;
    if (!product) return null;
    const isFree = Boolean(product.isFree) || numberOrZero(product.price) === 0;
    return basePreview(product, {
      displayPrice: isFree ? 0 : numberOrZero(product.price),
      pricingType: isFree ? "free" : "one_time",
    });
  }

  if (input.entityType === "webinar") {
    const webinar = input.webinar;
    if (!webinar) return null;
    const options = parsePricingOptions(webinar.pricingOptions);
    const selected = options[0] ?? null;
    const price = numberOrZero(selected?.price);
    const isFree = webinar.accessType === "free" || price <= 0;
    return basePreview(webinar, {
      courseSubtitle: typeof webinar.hostTitle === "string" ? webinar.hostTitle : null,
      displayPrice: isFree ? 0 : price,
      pricingType: isFree ? "free" : "one_time",
    });
  }

  const plan = input.membership;
  if (!plan) return null;
  const price = numberOrZero(plan.price);
  const interval = String(plan.billingInterval ?? "monthly");
  const isFree = price === 0;
  const isSubscription = !isFree && interval !== "one_time" && interval !== "lifetime";
  return basePreview(plan, {
    displayPrice: isFree ? 0 : price,
    pricingType: isFree ? "free" : isSubscription ? "subscription" : "one_time",
    isSubscription,
    billingLabel: isSubscription ? (interval === "annual" ? "per year" : "per month") : null,
  });
}
