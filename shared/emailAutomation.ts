export const EMAIL_AUTOMATION_SCOPES = ["learn", "apps", "expo"] as const;
export type EmailAutomationScope = (typeof EMAIL_AUTOMATION_SCOPES)[number];

export const EMAIL_AUTOMATION_TRIGGERS = [
  "account_signup",
  "course_purchase",
  "course_enrollment",
  "course_completion",
  "webinar_registration",
  "workshop_registration",
  "product_purchase",
  "list_signup",
  "expo_registration",
  "expo_vendor_approved",
] as const;
export type EmailAutomationTrigger = (typeof EMAIL_AUTOMATION_TRIGGERS)[number];

export const EMAIL_AUTOMATION_TRIGGER_META: Record<EmailAutomationTrigger, {
  label: string;
  description: string;
  scopes: EmailAutomationScope[];
  targetType?: "course" | "webinar" | "workshop" | "product" | "list" | "expo_event";
}> = {
  account_signup: { label: "Account is created", description: "A person creates a shared platform account.", scopes: ["learn", "apps", "expo"] },
  course_purchase: { label: "Course or quiz is purchased", description: "A paid LMS course or quiz checkout is fulfilled.", scopes: ["learn"], targetType: "course" },
  course_enrollment: { label: "Course or quiz enrollment is granted", description: "Access is granted to a course or quiz, including an admin or free enrollment.", scopes: ["learn"], targetType: "course" },
  course_completion: { label: "Course lesson is completed", description: "A learner marks a lesson complete. Select a course to limit the rule.", scopes: ["learn"], targetType: "course" },
  webinar_registration: { label: "Webinar registration is created", description: "A person is registered for a webinar.", scopes: ["learn"], targetType: "webinar" },
  workshop_registration: { label: "Workshop registration is created", description: "A person is registered for a workshop instance.", scopes: ["learn"], targetType: "workshop" },
  product_purchase: { label: "Product or download is purchased", description: "A product or download purchase is fulfilled.", scopes: ["learn", "apps"], targetType: "product" },
  list_signup: { label: "Contact joins an email list", description: "A contact subscribes to a selected email list or lead-capture list.", scopes: ["learn", "apps", "expo"], targetType: "list" },
  expo_registration: { label: "UltrasoundExpo registration is confirmed", description: "An attendee, exhibitor, or sponsor completes a paid event registration.", scopes: ["expo"], targetType: "expo_event" },
  expo_vendor_approved: { label: "Expo vendor, exhibitor, or sponsor is approved", description: "An administrator approves a partner application for UltrasoundExpo™.", scopes: ["expo"], targetType: "expo_event" },
};

export const EMAIL_AUTOMATION_TEMPLATE_TOKENS = [
  "{{first_name}}",
  "{{full_name}}",
  "{{email}}",
  "{{event_name}}",
  "{{content_name}}",
  "{{platform_area}}",
] as const;
