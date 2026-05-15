import type { Block } from "@/components/BlockPreview";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function cloneBlocks(blocks: Omit<Block, "id">[]): Block[] {
  return blocks.map((block) => ({ ...block, id: uid(), data: { ...block.data } }));
}

export const FUNNEL_TEMPLATES: Array<{
  name: string;
  description: string;
  blocks: Omit<Block, "id">[];
}> = [
  {
    name: "Adult Echo Cross-Training Funnel",
    description: "Long-form webinar/cohort sales page inspired by the Adult Echo cross-training workflow.",
    blocks: [
      {
        type: "hero",
        data: {
          headline: "Adult Echo Cross-Training Course",
          headline2: "Build confidence reading cardiac anatomy, Doppler, and pathology",
          subheadline: "A cohort-style sales funnel for sonographers moving into adult echo, with clear outcomes, urgency, and checkout flow.",
          bgType: "gradient",
          gradientFrom: "#0f766e",
          gradientTo: "#0f172a",
          gradientDir: "to bottom right",
          textColor: "#ffffff",
          align: "left",
          buttons: [
            { text: "Reserve Your Seat", color: "#ffffff", textColor: "#0f766e", link: "#checkout", style: "filled" },
            { text: "See What You Get", color: "#ffffff", textColor: "#ffffff", link: "#offer-stack", style: "outline" },
          ],
        },
      },
      {
        type: "alert",
        data: {
          text: "Live classes meet three evenings per week with replay access. Enrollment is limited for each cohort.",
          alertType: "warning",
          icon: "!",
        },
      },
      {
        type: "funnel_workflow",
        data: {
          eyebrow: "ClickFunnels-style workflow",
          headline: "Guide visitors from interest to paid enrollment",
          subtext: "Use one connected sales path: landing page, checkout, order bump, and thank-you page.",
          accentColor: "#0f766e",
          bgColor: "#f0fdfa",
          steps: [
            { name: "Promise", role: "Lead with the transformation: cross-train into adult echo with structured guidance.", url: "#top", cta: "Read offer" },
            { name: "Proof", role: "Show the curriculum, instructor expertise, and case-based learning outcomes.", url: "#curriculum", cta: "Review curriculum" },
            { name: "Checkout", role: "Move qualified buyers into the main course purchase.", url: "#checkout", cta: "Enroll" },
            { name: "Bump", role: "Offer a physical workbook or digital checklist before payment is complete.", url: "#order-bump", cta: "View bump" },
          ],
        },
      },
      {
        type: "bullets",
        data: {
          headline: "What students learn",
          items: [
            "Standard adult echo windows, probe positions, and image optimization",
            "Cardiac anatomy, physiology, and pressure-volume relationships",
            "Color and spectral Doppler interpretation in real exams",
            "Valve disease, cardiomyopathy, pericardial disease, and hemodynamics",
            "Case-based clinical reasoning instead of memorized pattern matching",
            "Replay-supported live training for busy scanning schedules",
          ],
          iconColor: "#0f766e",
          bgColor: "#ffffff",
        },
      },
      {
        type: "two_column",
        data: {
          leftHtml: "<h2>Designed for sonographers crossing into echo</h2><p>Position the program for general, vascular, or multi-modality sonographers who need a structured bridge into adult echocardiography.</p>",
          rightHtml: "<h3>Funnel message</h3><ul><li>Live cohort urgency</li><li>Replay access</li><li>Hands-on optional add-on</li><li>Clear next step to checkout</li></ul>",
          leftRatio: 55,
          bgColor: "#f8fafc",
        },
      },
      {
        type: "product_offer_stack",
        data: {
          headline: "Stack the core offer with digital and physical add-ons",
          subtext: "Promote the main course plus optional resources that increase cart value.",
          accentColor: "#0f766e",
          bgColor: "#ffffff",
          products: [
            { type: "digital", title: "Adult Echo Digital Resource Pack", description: "Printable protocols, Doppler references, and case review prompts.", price: "$49", ctaText: "Add digital pack", ctaLink: "#checkout", fulfillment: "Instant access after checkout." },
            { type: "physical", title: "Printed Echo Workbook", description: "A shipped workbook for note-taking, protocols, and scanning checklists.", price: "$29", ctaText: "Add workbook", ctaLink: "#order-bump", fulfillment: "Physical shipment after purchase." },
          ],
        },
      },
      {
        type: "order_bump_checkout",
        data: {
          anchorId: "order-bump",
          discountLabel: "Checkout add-on",
          headline: "Add the printed Adult Echo workbook",
          subheadline: "Give buyers a tangible companion for the live cohort.",
          description: "This order bump can represent a shipped workbook, badge card set, or digital bonus pack.",
          productType: "physical",
          price: "$29",
          compareAtPrice: "$59",
          checkboxLabel: "Yes, add the workbook to my enrollment",
          ctaText: "Add workbook and continue",
          skipText: "Continue without workbook",
          shippingNote: "Shipping collected at checkout",
          features: ["Printable scanning checklists", "Protocol notes for standard views", "Great for live class follow-along"],
          accentColor: "#f59e0b",
          bgColor: "#fffbeb",
        },
      },
      {
        type: "faq",
        data: {
          headline: "Frequently asked questions",
          items: [
            { q: "Who is this for?", a: "Sonographers who want a guided path into adult echo scanning and interpretation." },
            { q: "What if I miss a live class?", a: "Use this section to explain replay access, office hours, and cohort support." },
            { q: "Can I sell physical and digital items?", a: "Yes. Use the offer stack and order bump blocks to promote both product types." },
          ],
          bgColor: "#ffffff",
          accentColor: "#0f766e",
        },
      },
      {
        type: "pricing_cta",
        data: {
          headline: "Ready to reserve your seat?",
          subtext: "Send qualified buyers to checkout with the optional bump selected in the sales workflow.",
          ctaText: "Enroll Now",
          ctaColor: "#0f766e",
          ctaTextColor: "#ffffff",
          bgColor: "#f0fdfa",
          showPrice: true,
        },
      },
    ],
  },
];

export function getFunnelTemplateBlocks(index: number) {
  const template = FUNNEL_TEMPLATES[index];
  return template ? cloneBlocks(template.blocks) : [];
}
