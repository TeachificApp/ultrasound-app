# Railway Editor Upload Live Inspection

## 2026-08-29

The Railway session is authenticated as the project owner. The relevant production project is **Ultrasound-App** (`bd15256f-be9c-4d5e-838d-daae94448fa1`) and exposes two healthy services. The application service to inspect for the editor upload is `3cff5aaf-a482-4920-ab9f-ce8760375751`; the other service is MySQL and is not the upload runtime.

The immediate verification path is to confirm the application service’s production deployment source/revision, inspect the non-secret variable presence and deployment logs, and then reproduce one authenticated editor upload. Secret values, bucket identifiers, database URLs, and provider error bodies must not be recorded.

Direct navigation to the service route briefly failed into a blank browser state in this session. The next attempt will re-enter through the authenticated project dashboard and use the service card rather than assuming the direct route loaded.

The application-service card route was then successfully selected from the authenticated dashboard. Railway is still rendering the service page, so no deployment revision, log entry, or variable information has been recorded yet.

The production application service is online and its active GitHub deployment is the checkpoint that hardened R2 Access Denied handling and aligned probing with the `lms-images/` upload prefix. Railway reports the deployment as successful. This rules out a stale service revision as the cause of any newly reproduced editor-upload failure.

The service is confirmed to be in Railway’s **production** environment. Its Variables view lists all R2 configuration names needed by the application, including the account ID, access key ID, secret access key, bucket name, public URL, and the forced storage-backend selector. Values were not opened, copied, or recorded. The service also has additional legacy-looking R2 variables, but the application code uses the canonical variables above and constructs the R2 endpoint from the account ID. Since no Forge credentials are present in the service variables, the existing fallback cannot independently complete a denied R2 upload on Railway.

Railway has provisioned the active application deployment’s log connection. The interactive service console initially reported no attachable instance, but the project Logs view selected a live deployment instance and is loading its runtime output. No provider error text or credentials has been shown yet.

The production logs confirm that the active deployment started successfully and that Railway is the primary host. They do not contain a post-deployment rich-text image-upload request or storage denial to diagnose. The logs also indicate a separate OAuth configuration warning and no session on the browser’s public-site visit; those are not part of the current image-upload repair and are not being changed in this work.

The deployment configuration includes an explicit Cloudflare R2 endpoint variable that the existing R2 client did not consume. The client now uses this endpoint when it is a valid HTTPS Cloudflare R2 S3 hostname and otherwise retains the canonical account-derived endpoint. This supports an existing correct endpoint if the legacy account-ID variable differs from the R2 S3 account endpoint. Focused storage/upload authorization tests (nine tests) and targeted server bundles pass. A live editor upload is still required to confirm the provider accepts the actual write.
