# Public-Domain SEO Architecture for All About Ultrasound and iHeartEcho

**Prepared by:** Manus AI
**Date:** September 19, 2026

## Recommendation

Build the two public sites **inside the current application and content-management workflow**, while continuing to serve them on their own established domains:

- `www.allaboutultrasound.com` becomes the public authority site for general ultrasound, sonography, registry review, POCUS, vascular, OB/GYN, breast, careers, and general professional education.
- `www.iheartecho.com` becomes the public authority site for echocardiography, cardiac sonography, echo registry review, fetal echo, ACS, diastology, accreditation, and cardiac cross-training.
- `learn.allaboutultrasound.com` remains the transactional education catalog and learner destination. Its public course, workshop, webinar, download, and membership landing pages should be indexable when they are genuinely distinct from the marketing pages.
- `app.allaboutultrasound.com` and `app.iheartecho.com` remain authenticated clinical-app experiences. Their protected tools, dashboards, account pages, checkout flows, quiz players, and other private routes should remain excluded from search indexing.

This model preserves the accumulated search value and brand identity of both public domains. It avoids turning the app into a duplicate public website. It also creates a clear route from search discovery, to a brand-relevant public page, to a specific course or membership on Learn, and finally to the appropriate authenticated app.

> **Do not merge iHeartEcho into All About Ultrasound or canonicalize one brand’s public site to the other.** They address related but distinct professional search intent. Each needs its own original content, self-referencing canonical URLs, sitemap, navigation, and editorial focus.

Google treats permanent redirects, `rel="canonical"`, and sitemap inclusion as complementary canonicalization signals. They should all agree when a page has moved or a duplicate must be consolidated. [3]

## Current position

The public sites already have distinct content footprints and public sitemaps. The All About Ultrasound sitemap exposes approximately **179 URLs**, while the iHeartEcho sitemap exposes approximately **73 URLs**. The Learn sitemap exposes approximately **49 URLs**, including public course and download pages. [1] [2] [8]

The current All About Ultrasound and iHeartEcho homepages both expose title, description, and Open Graph metadata. Their raw homepage HTML did not expose a `rel="canonical"` element in this audit. The current app hosts present broad application metadata, but they are not the right home for duplicated long-form marketing content. [1] [2]

The repository already includes useful foundations: a Site Pages domain registry, a public-page builder, a marketing-site importer, a staging marketing host, a dynamic sitemap route, and JSON-LD helpers. However, the marketing import workflow is currently hard-coded to one All About Ultrasound staging site, and the public marketing renderer is client-rendered and explicitly marked as a staging experience. It is **not yet a production-ready, two-domain SEO delivery layer**.

## Ownership model: one page, one search owner

Every meaningful topic should have one primary indexable page. The table below is the governing rule for content planning.

| Content type | Primary public owner | Secondary destinations | Indexing rule |
|---|---|---|---|
| General ultrasound education, sonography, POCUS, vascular, OB/GYN, breast, SPI | `www.allaboutultrasound.com` | Relevant Learn catalog/course page; UltrasoundAssist app | The public article or service page owns the general-intent keyword. Learn owns the transactional course page. |
| Echo, adult/pediatric/fetal echocardiography, ACS, diastology, accreditation | `www.iheartecho.com` | Relevant Learn catalog/course page; EchoAssist app | The iHeartEcho page owns echo-specific informational and service-intent keywords. |
| Courses, CME enrollments, workshops, downloads, memberships, webinars | `learn.allaboutultrasound.com` | Brand public landing page and app as contextual referrals | Each catalog or product page is indexable only when its content and purchase/registration purpose are unique. |
| Clinical calculators, protected learning tools, dashboards, profiles, quizzes, course players, checkout | App and Learn hosts | Public marketing pages as entry points | `noindex`; users may access them through login, a product flow, a member link, or a secure launch path. |
| Shared corporate, legal, support, privacy, contact, careers content | One designated brand-specific page or a neutral root authority page | Cross-link only where useful | Avoid publishing the same body text on both public domains. Use a dedicated canonical owner if the content must be identical. |

This does not mean the brands should stop cross-linking. They should link deliberately. For example, an iHeartEcho fetal-echo overview can link to a relevant fetal-echo course on Learn and to a related All About Ultrasound hands-on workshop. The linked pages must retain different purpose and substantive content.

## The technical approach

### 1. Make the public-site system multi-tenant by hostname

Extend the existing Site Pages and marketing-page infrastructure to model two production public tenants:

| Tenant | Hostname | Brand | Source sitemap during migration |
|---|---|---|---|
| All About Ultrasound public site | `www.allaboutultrasound.com` | AAUS | Existing All About Ultrasound sitemap |
| iHeartEcho public site | `www.iheartecho.com` | iHeartEcho | Existing iHeartEcho sitemap |
| AAUS staging | `site.allaboutultrasound.com` | AAUS | Noindex preview only |
| iHeartEcho staging | A new non-indexed staging hostname | iHeartEcho | Noindex preview only |

The import process should accept a tenant key and source origin instead of relying on a single hard-coded source. Each tenant needs isolated page records, navigation, branding, SEO defaults, source URL mapping, and publication status. A page edit for iHeartEcho must never affect the All About Ultrasound version.

### 2. Server-render or pre-render every indexable public page

The existing production application is a client-rendered React application. That can be crawled by Google, but it creates a second rendering step and makes social-preview bots and non-Google crawlers less reliable. Google specifically notes that server-side or pre-rendering improves performance for both users and crawlers, and that not all bots execute JavaScript. [6]

Public marketing pages, public course landing pages, public downloads, public webinars, public workshops, and public articles should therefore be delivered with populated initial HTML. The response must include the visible page content, one accurate title, description, Open Graph/Twitter tags, one canonical URL, relevant JSON-LD, and a real 404 response for a genuine missing page. Protected and personalized app routes remain client-rendered and `noindex`.

### 3. Preserve existing URLs during the initial move

The safest move is a **hosting migration without URL changes**. Existing paths such as `.html` pages should remain valid on their existing public hostnames at launch. This preserves the current URL history and avoids a simultaneous hosting, URL-structure, CMS, and design change.

If a page must be renamed or merged, create an explicit old-to-new mapping before launch and use direct server-side `301` or `308` redirects to the closest equivalent final page. Do not redirect many unrelated historical URLs to a homepage; that can create a poor user experience and soft-404 signals. Google recommends a mapping, permanent server-side redirects, updated internal links, self-referencing canonicals, and a new sitemap for site moves. [4]

### 4. Generate a sitemap and robots file per public host

Each public hostname needs its own absolute-URL sitemap:

- `https://www.allaboutultrasound.com/sitemap.xml`
- `https://www.iheartecho.com/sitemap.xml`
- `https://learn.allaboutultrasound.com/sitemap.xml`

The sitemap for a host should list only that host’s canonical, indexable URLs. It should not include app dashboards, quizzes, checkout routes, member pages, staging pages, filters, or duplicate landing pages. Google advises listing only the URLs intended to appear in search results and using fully qualified canonical URLs. [5]

The production `robots.txt` file on each public host should reference that host’s sitemap. The staging hosts must retain `noindex, nofollow` responses and robots blocking until they are deliberately promoted.

### 5. Use consistent metadata and structured data

Every indexable page needs a self-referencing canonical URL in the initial HTML. Public AAUS and iHeartEcho pages should be canonical to their own brand host. Learn product pages should be canonical to Learn. The two public sites should not point canonical tags to the app domains.

Use JSON-LD only when it represents visible, accurate page content. Recommended structured data includes Organization and WebSite site-wide; BreadcrumbList for navigational depth; Article or BlogPosting for original editorial content; Event for workshops and live courses; Product and Offer for purchasable downloads or products; and Course where the public Learn page accurately describes the course. Google recommends JSON-LD as the easiest structured-data format to implement and maintain, and requires that it accurately describe visible page content. [7]

### 6. Treat internal linking as a conversion architecture

Public pages should use clear, descriptive links to the appropriate next step. Examples include:

- A general ultrasound article on AAUS links to its matching Learn course, download, workshop, or UltrasoundAssist feature.
- An echo article on iHeartEcho links to its matching Learn course, cross-training offering, or EchoAssist feature.
- Learn course pages link back to the most relevant public authority page for clinical context, instructor information, or supporting resources.
- App pages should not duplicate the same long-form marketing copy. They should send signed-out users to a public product explanation or Learn page when that is the better destination.

This improves crawl paths, makes the customer journey understandable, and avoids competing pages that target the same intent.

## Rollout sequence

### Phase 0: Stabilize deployment and create a no-write inventory

Resolve the separate Railway service health-check configuration issue before using Railway as the production public-site host. The repository configuration has already been cleaned so that it no longer supplies a health-check value; the remaining repeated error is a Railway saved service-setting issue, not public-site content or application code.

Before migration, export a read-only inventory of every current public URL from both sitemaps. For each URL, classify it as **preserve unchanged**, **migrate unchanged**, **merge to a named target**, **retire with a relevant redirect**, or **intentionally noindex**. Record titles, meta descriptions, Open Graph images, traffic/impression data from Search Console, inbound-link relevance, and conversion role.

### Phase 1: Build both sites behind noindex staging hosts

Create a second iHeartEcho staging host. Convert the existing staging-only marketing workflow into a tenant-aware preview system. Import and review the homepages first, then the highest-value page clusters:

1. Registry review and specialty education.
2. CME and course pathways.
3. Cross-training and workshop pages.
4. Accreditation, consulting, and services.
5. High-value articles, protocols, resources, and downloads.
6. Legal, support, contact, privacy, and terms pages.

At this stage, all staging pages stay blocked from indexing. No live DNS, source-domain content, course, or existing public URL changes are required.

### Phase 2: Add production-grade rendering and SEO controls

Implement server rendering or a controlled static pre-rendering path for public content. Add domain-aware metadata, one canonical tag per response, tenant-specific Organization/WebSite JSON-LD, per-domain sitemap generation, public 404 behavior, and direct redirect rules from the approved mapping.

Validate the raw HTML rather than relying only on browser rendering. The validation should check the page body, title, description, Open Graph image, canonical, HTTP status, robots behavior, JSON-LD, sitemap entry, and redirect destination for a representative sample of every page type.

### Phase 3: Content and navigation quality review

Use a shared component library but preserve distinct brand identity, voice, navigation, and content strategy. Improve each page while keeping its purpose intact. Do not mass-rewrite every legacy page during cutover. Google recommends changing one major dimension at a time; moving hosting, changing URLs, changing the CMS, and rewriting page content together makes search-impact diagnosis far harder. [4]

### Phase 4: Controlled domain cutover

After staging acceptance, production build health, raw HTML checks, and redirect testing pass:

1. Point `www.allaboutultrasound.com` to the production public-site service.
2. Confirm the same hostname and legacy path resolve directly on the new service.
3. Verify the AAUS sitemap and Search Console property.
4. Repeat for `www.iheartecho.com`.
5. Keep legacy hosting available only as a rollback source until the new production responses and redirects are proven.

Because the hostnames and priority paths should remain unchanged, this is primarily a controlled hosting cutover rather than a domain move. Any intentionally renamed page still requires its page-level permanent redirect.

### Phase 5: Search Console, analytics, and post-launch monitoring

Verify separate Search Console domain properties for All About Ultrasound, iHeartEcho, Learn, and the app hosts. Submit each sitemap. Track index coverage, canonical selection, crawl errors, Core Web Vitals, impressions, clicks, leading queries, and conversions by host and template.

Use a shared analytics property with cross-domain measurement for the public sites, Learn, and app hosts. Preserve UTM parameters and first-touch referral information through public-site-to-Learn-to-app paths. This gives a measurable view of which public content actually produces membership, course, workshop, and app outcomes.

## What should not be done

Do not publish identical public pages on both brand domains. Do not send all legacy URLs to one generic homepage. Do not point every public page at Learn or an app canonical. Do not include private routes in public sitemaps. Do not expose protected app previews or customer-specific HTML to crawlers. Do not remove the old public site before its direct replacement paths, redirects, and Search Console checks are validated.

## Recommended next implementation scope

The next safe implementation should be a **no-DNS, no-content-loss foundation**:

1. Add first-class `www.allaboutultrasound.com` and `www.iheartecho.com` tenants to the existing public-page framework.
2. Generalize the marketing importer so each tenant has a separate source sitemap, page namespace, navigation, and brand configuration.
3. Add an iHeartEcho noindex staging host.
4. Build host-aware server-rendered metadata, canonical tags, sitemaps, robots output, JSON-LD, and redirect mapping support for public routes.
5. Generate the read-only URL inventory and a staged page-by-page migration map before importing or replacing live content.

This approach lets the public websites be managed in the same system as Learn and the apps without collapsing distinct brands or sacrificing existing search equity.

## Implemented `.net` Review Foundation and `.com` Promotion Plan

The current implementation uses the following two independent public-site tenants. The rows, page paths, navigation, editable blocks, blog records, SEO fields, and source-link audit are all tenant-scoped. There is no content copy to recreate on promotion day.

| Brand | Current review host | Eventual production host | Existing source site |
|---|---|---|---|
| All About Ultrasound | `www.allaboutultrasound.net` | `www.allaboutultrasound.com` | `https://www.allaboutultrasound.com` |
| iHeartEcho | `www.iheartecho.net` | `www.iheartecho.com` | `https://www.iheartecho.com` |

The `.net` hosts are intentionally **noindex**. Their `robots.txt` blocks crawling and their sitemap is empty. This prevents a temporary review copy from competing with the presently live `.com` source. The `.net` pages nevertheless emit the planned `.com` canonical destination so there is one documented final owner for each retained URL. When a matching `.com` hostname is attached to the Railway service, the exact same tenant data becomes indexable and its sitemap automatically lists only published pages on that `.com` host.

### Editorial workflow

Effective Platform Admins open **Public Website & Blog** from the selected brand’s Platform Admin tools. The workspace supports a controlled sitemap or individual-URL import, separate website-page and blog-post lists, draft/publish state, and the block-based WYSIWYG editor for every page. Blog posts add author, category, excerpt, publication date, SEO, and Open Graph fields. Imported source content is converted into editable blocks; it does not modify the source site.

During import, the content transformer changes `member.allaboutultrasound.com` and `members.allaboutultrasound.com` links to `https://learn.allaboutultrasound.com`, retaining the path, query, and fragment. Existing Learn links are retained. Same-brand public links become same-tenant relative links, and cross-brand public links use the relevant current `.net` host until the promotion date.

### Required launch sequence

1. Deploy the GitHub-main revision and apply `drizzle/0069_dual_public_site_editor.sql` to the Railway MySQL database. The migration is additive: it creates two tenant settings rows and blog metadata columns without replacing legacy public-site content.
2. Add `www.allaboutultrasound.net` and `www.iheartecho.net` as Railway custom domains, then create the DNS records Railway supplies. Test both homepages, a normal page, an `.html` legacy path, the blog index, a blog post, `robots.txt`, and `sitemap.xml`. Do not index these review hosts.
3. As a Platform Admin, run controlled imports in batches from the **Public Website & Blog** tool. Review source content, images, navigation, imported course links, page metadata, and device layouts before publishing each group. Source pages remain untouched.
4. Before any `.com` DNS cutover, export and approve a one-to-one redirect map for every URL that will change. Preserve all unchanged paths exactly; direct relevant server-side permanent redirects only for deliberate moves or consolidations.
5. At the approved cutover, add each `.com` hostname to Railway, verify Railway’s domain ownership record, then change DNS from the prior provider only after the new service responds correctly. Keep the prior hosting configuration available for rollback until direct path checks, 301/308 redirects, raw metadata, canonical tags, Search Console coverage, and analytics events are confirmed.
6. Submit the final `https://www.allaboutultrasound.com/sitemap.xml` and `https://www.iheartecho.com/sitemap.xml` to their respective Search Console properties. The `learn.allaboutultrasound.com` sitemap remains separate and should contain only its own public transactional content.

> The review-domain configuration is an SEO safety measure, not a replacement for launch validation. Do not remove the old `.com` hosting or change live DNS until the public-site import, content quality review, redirect map, and Railway domain checks are complete.

## References

[1]: https://www.allaboutultrasound.com "All About Ultrasound public website"
[2]: https://www.iheartecho.com "iHeartEcho public website"
[3]: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls "Google Search Central: consolidate duplicate URLs"
[4]: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes "Google Search Central: how to move a site"
[5]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap "Google Search Central: build and submit a sitemap"
[6]: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics "Google Search Central: JavaScript SEO basics"
[7]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: structured data markup"
[8]: https://learn.allaboutultrasound.com "All About Ultrasound and iHeartEcho Learning Platform"
