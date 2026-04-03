import type { Metadata } from "next";
import { Suspense } from "react";
import { PrivacyPageContent } from "./PrivacyPageContent";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "Wispoのプライバシーポリシー。個人情報の取扱い、広告配信、クッキー（Cookie）、アクセス解析についてご説明します。",
  keywords: ["知育", "パズル", "無料", "プライバシーポリシー"],
};

export default function PrivacyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-wit-bg" />}>
      <PrivacyPageContent />
    </Suspense>
  );
}
