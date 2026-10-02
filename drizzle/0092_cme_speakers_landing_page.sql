-- Additive All About Ultrasound CMS source for the Learn-domain CME Speakers landing page.
-- Public URL: https://learn.allaboutultrasound.com/cme-speakers
-- The page stays out of all public menus but is editable in the Site Pages visual editor.
INSERT INTO `marketingSitePages` (
  `siteKey`, `parentId`, `path`, `title`, `pageType`, `blocks`,
  `hideInNavigation`, `visibility`, `headerType`,
  `seoTitle`, `seoDescription`, `seoKeywords`, `hideFromSearch`,
  `isPublished`, `sortOrder`, `importStatus`, `createdAt`, `updatedAt`
)
SELECT
  'aaus-net',
  NULL,
  '/cme-speakers',
  'CME Speaker Disclosure',
  'page',
  '[
    {
      "id": "cme-speakers-hero",
      "type": "hero",
      "data": {
        "headline": "CME Speaker Disclosure",
        "subheadline": "Complete your financial disclosure for an All About Ultrasound™ continuing medical education activity.",
        "bgType": "gradient",
        "gradientDir": "to bottom right",
        "gradientFrom": "#0e4a50",
        "gradientTo": "#179ca3",
        "textColor": "#ffffff",
        "headlineColor": "#ffffff",
        "align": "center",
        "hideButtons": true,
        "heroMinHeight": 260
      }
    },
    {
      "id": "cme-speakers-intro",
      "type": "text",
      "data": {
        "html": "<div style=\"max-width:760px;margin:0 auto;text-align:center\"><h2>For speakers, faculty, planners, and content reviewers</h2><p>Please complete the disclosure below for each CME activity you support. Your response is securely delivered to the All About Ultrasound™ CME team and CardioServ for review.</p><p>If you have questions or need to share supporting material, contact <a href=\"mailto:admin@allaboutultrasound.com\">admin@allaboutultrasound.com</a>.</p></div>",
        "align": "center",
        "bgColor": "#ffffff",
        "textColor": "#24313a"
      }
    },
    {
      "id": "cme-speakers-disclosure-form",
      "type": "embed",
      "data": {
        "embedCode": "<iframe src=\"/cme-disclosure/generic\" title=\"CME Speaker Financial Disclosure Form\" style=\"width:100%;height:1280px;border:0;display:block\" loading=\"lazy\"></iframe>",
        "height": 1320,
        "align": "center",
        "maxWidth": "100%",
        "caption": ""
      }
    },
    {
      "id": "cme-speakers-supporting-documents",
      "type": "alert",
      "data": {
        "alertType": "info",
        "icon": "📎",
        "text": "Supporting documents and downloads can be added or updated by a Platform Admin in this page’s visual editor."
      }
    }
  ]',
  TRUE,
  'public',
  'no_header',
  'CME Speaker Disclosure | All About Ultrasound',
  'Submit a CME speaker financial disclosure to All About Ultrasound and CardioServ.',
  'CME speaker disclosure, financial disclosure, ultrasound CME faculty',
  TRUE,
  TRUE,
  9999,
  'imported',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `marketingSitePages`
  WHERE `siteKey` = 'aaus-net' AND `path` = '/cme-speakers'
);
