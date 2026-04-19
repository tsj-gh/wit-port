/** サイトの絶対URL（末尾スラッシュなし）。sitemap / robots / canonical 用 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://wit-spot.vercel.app";
  return raw.replace(/\/+$/, "");
}

function hostnameIsCloudflarePagesDev(host: string): boolean {
  const h = host.toLowerCase();
  return h === "wispo.pages.dev" || h.endsWith(".pages.dev");
}

function tryHostnameLooksPagesDev(raw: string | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return hostnameIsCloudflarePagesDev(new URL(normalized).hostname);
  } catch {
    return false;
  }
}

/**
 * ビルド時に「この成果物は *.pages.dev で配る」と分かる場合 true。
 * `NEXT_PUBLIC_SITE_URL` を優先し、補助として `NEXT_PUBLIC_VERCEL_URL` / `VERCEL_URL` も見る。
 */
export function isPagesDevSiteUrl(): boolean {
  if (tryHostnameLooksPagesDev(process.env.NEXT_PUBLIC_SITE_URL)) return true;
  if (tryHostnameLooksPagesDev(process.env.NEXT_PUBLIC_VERCEL_URL)) return true;
  if (tryHostnameLooksPagesDev(process.env.VERCEL_URL)) return true;
  try {
    return hostnameIsCloudflarePagesDev(new URL(getSiteUrl()).hostname);
  } catch {
    return false;
  }
}
