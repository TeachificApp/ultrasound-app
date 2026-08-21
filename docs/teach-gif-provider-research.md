# Teach Game GIF Provider Research

## Recommendation

Use **GIPHY** for the Teach game’s educator-facing GIF search. Tenor’s official documentation states that it stopped accepting new API clients in January 2026, while GIPHY continues to provide an API-key onboarding flow.

For an education-oriented authoring experience, the integration should use GIPHY’s `rating=g` search filter, show the required Powered by GIPHY attribution, and retain the direct GIF URL field as a manual fallback. GIPHY documents a beta-key limit of 100 searches/API calls per hour and requires a separate API key per platform and section; higher-volume production use requires a production-key application.

## Safety Controls

GIPHY maintains blocked search terms and provides an API-key-level GIF blocking tool. The Teach integration should use both GIPHY’s `rating=g` parameter and an application-level blocked-term list appropriate for education settings.

## Sources

- https://developers.giphy.com/docs/api/
- https://developers.giphy.com/docs/trust-and-safety/
- https://developers.google.com/tenor/guides/quickstart
- https://developers.google.com/tenor/guides/endpoints
