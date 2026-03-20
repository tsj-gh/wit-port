"use client";

import { DevLink } from "./DevLink";

/**
 * お問い合わせへのリンク（devtj パラメータ維持）
 */
export function ContactLink({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <DevLink href="/contact" className={className}>
      {children}
    </DevLink>
  );
}
