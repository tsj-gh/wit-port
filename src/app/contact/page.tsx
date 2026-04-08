import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactPageContent } from "./ContactPageContent";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "Wispoへのお問い合わせは、こちらのフォームよりお送りください。",
  keywords: ["知育", "パズル", "無料", "お問い合わせ"],
};

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-bg)]" />}>
      <ContactPageContent />
    </Suspense>
  );
}
