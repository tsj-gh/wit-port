/**
 * devtj デバッグパラメータの維持・永続化
 */

const STORAGE_KEY = "wispo_devtj";

/** href に devtj=true を付与（既存クエリがあればマージ） */
export function appendDevtj(href: string, hasDevtj: boolean): string {
  if (!hasDevtj) return href;
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("devtj", "true");
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** 現在 devtj が有効か（URL または sessionStorage） */
export function hasDevtj(searchParams: URLSearchParams | null): boolean {
  if (typeof window === "undefined") return false;
  if (searchParams?.get("devtj") === "true") {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    return true;
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
