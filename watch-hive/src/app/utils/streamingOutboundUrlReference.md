# Streaming outbound URL patterns

Maintainer reference for deep links vs search fallbacks. Code that resolves outbound URLs should stay aligned with this document; see `providerCanonicalLinks.js` and `watchProviderUrls.js`.

TMDB’s per-provider `link` on `watch/providers` responses is the primary source of **deep** URLs when present. **Search** URLs on each service are fallbacks when no safe direct link exists.

## Netflix

| Pattern | Example | Notes |
|--------|---------|--------|
| Title / details | `https://www.netflix.com/title/{titleId}` | |
| Locale + title | `https://www.netflix.com/{cc}/title/{titleId}` | e.g. `ca` — treat like `/title/{id}` for parsing. |
| Play / watch | `https://www.netflix.com/watch/{videoId}` | Playable item; episode-level when TMDB exposes `watch`. |

## Prime Video

| Pattern | Example | Notes |
|--------|---------|--------|
| Detail (slug + id) | `https://www.primevideo.com/detail/{slug}/{id}` | |
| Detail (id only) | `https://www.primevideo.com/detail/{id}` | Single path segment after `detail/`. |
| `gti` query | Amazon / Prime URLs with `?gti=` or `&gti=` | Common alternate form. |

## Disney+

| Pattern | Example | Notes |
|--------|---------|--------|
| Movie | `https://www.disneyplus.com/movies/{slug}/{id}` | |
| Series | `https://www.disneyplus.com/series/{slug}/{id}` | |
| Entity | `https://www.disneyplus.com/browse/entity-{uuid}` | Episode UX usually lives inside series/entity pages. |
| Search UI | `https://www.disneyplus.com/browse/search?q=…` | Search, not a canonical title page. |

## Hulu

| Pattern | Example | Notes |
|--------|---------|--------|
| Watch | `https://www.hulu.com/watch/{id}` | Movies and episodes. |

## Other services (search fallbacks in WatchHive)

TMDB `provider_id` → native search URL used when no per-provider deep link is available:

| Service | TMDB `provider_id` | Search URL pattern |
|--------|---------------------|-------------------|
| Apple TV+ | `350` | `https://tv.apple.com/search?term=…` |
| Max (HBO) | `384`, `1899` | `https://play.max.com/search?q=…` |
| Paramount+ | `531` | `https://www.paramountplus.com/search/?q=…` |
| Crave | `61`, `2300` | `https://www.crave.ca/en/search?q=…` |
| Peacock | `386`, `387` | `https://www.peacocktv.com/search?q=…` |
| Crunchyroll | `283` | `https://www.crunchyroll.com/search?q=…` |
| Netflix | `8`, `1796` | `https://www.netflix.com/search?q=…` |
| Prime Video | `9`, `119` | `https://www.primevideo.com/search?phrase=…` |
| Disney+ | `337` | `https://www.disneyplus.com/browse/search?q=…` |
| Hulu | `15` | `https://www.hulu.com/hub/search?q=…` |

This list is not the full TMDB provider catalog—only providers WatchHive maps explicitly in code.

## Watchmode (optional deeplinks, on demand)

When **`WATCHMODE_API_KEY`** is set (server env only), clicking a streaming icon that does not already have a solid TMDB deeplink calls **`GET /api/watch/watchmode-resolve`**, which queries [Watchmode](https://api.watchmode.com/) for a `web_url`, then opens it (or falls back to the per-provider search URL). Watchmode is **not** called when prefetching `provider-links`. Prime responses are passed through **`canonicalizeStreamingWebUrl`** to drop trailing `/ref=…` path noise.

Free Watchmode tiers may omit or limit some `web_url` values; paid plans expose fuller deeplinks per [their documentation](https://api.watchmode.com/).
