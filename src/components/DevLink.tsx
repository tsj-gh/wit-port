"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { appendDevtj, hasDevtj } from "@/lib/devtj";

type DevLinkProps = React.ComponentProps<typeof Link>;

/**
 * devtj=true を維持したまま遷移する Link ラッパー
 */
export function DevLink({ href, ...props }: DevLinkProps) {
  const searchParams = useSearchParams();
  const keepDevtj = hasDevtj(searchParams);

  const resolvedHref =
    typeof href === "string"
      ? appendDevtj(href, keepDevtj)
      : href;

  return <Link href={resolvedHref} {...props} />;
}
