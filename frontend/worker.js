// Runs on Cloudflare in front of the web app. Static files are served directly; requests
// under /api are passed on to the .NET API, which is hosted elsewhere. To the browser the
// web app and the API are therefore one site, which the sign-in cookie needs.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    if (!env.API_ORIGIN || !env.PROXY_KEY) return new Response('The API address is not configured.', { status: 502 })

    const proxied = new Request(new URL(url.pathname + url.search, env.API_ORIGIN), request)
    // The API sees Cloudflare's address, not the visitor's. Pass the real one on, with the
    // shared key that proves this header came from us and was not typed in by the visitor.
    proxied.headers.set('X-HSMLIS-Proxy-Key', env.PROXY_KEY)
    proxied.headers.set('X-HSMLIS-Client-IP', request.headers.get('CF-Connecting-IP') ?? '')
    // Also carries the live-update WebSocket (/api/live): Cloudflare passes the upgrade through.
    return fetch(proxied, { redirect: 'manual' })
  },
}
