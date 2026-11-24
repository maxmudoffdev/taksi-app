/**
 * Backend manzili.
 * Kompyuterda: VITE_BACKEND_URL (http://localhost:4000).
 * Telefondan (bitta Wi-Fi, `npm run dev:lan`): "localhost" telefonning o'zini bildiradi —
 * shuning uchun so'rovlar saytning o'z manzili orqali yuboriladi, Vite ularni backendga uzatadi (proxy).
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1']

function resolveBackendUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_URL
  try {
    const target = new URL(configured)
    if (LOCAL_HOSTS.includes(target.hostname) && !LOCAL_HOSTS.includes(window.location.hostname)) {
      return window.location.origin
    }
  } catch {
    /* noto'g'ri manzil — o'zgarishsiz */
  }
  return configured
}

export const BACKEND_URL = resolveBackendUrl()
