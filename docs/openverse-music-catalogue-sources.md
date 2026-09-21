# Openverse CC0 Music Catalogue Sources

The external music picker uses the public Openverse Audio API server-side. The integration limits search and preview requests to Openverse results explicitly labelled **CC0 1.0**, non-mature, HTTPS, and MP3-compatible. A live validation on September 21, 2026 confirmed `GET https://api.openverse.org/v1/audio/?q=ambient&license=cc0&page_size=5` returns CC0 MP3 previews from Freesound, including the licence URL and attribution metadata.

Openverse API Terms: <https://wordpress.github.io/openverse-api/terms_of_service.html>. The terms require adherence to documented limits, prohibit scraping, require respecting each result's licensing conditions, require a prominent indication that the application uses Openverse but is not endorsed by it, and state that Openverse aggregates third-party metadata without independently verifying licensing. The product UI therefore displays the provider, licence, attribution, source link, and an explicit administrator verification notice.

CC0 reference: <https://creativecommons.org/publicdomain/zero/1.0/>. CC0 allows copying, modifying, distributing, and performing the work, including commercially, without permission; Creative Commons also states it does not verify copyright status. This integration does not download or persist catalogue tracks, does not present non-commercial or no-derivatives tracks, and streams only a selected CORS-enabled preview in the administrator's browser for MP4 export.

Retrieved September 21, 2026.
