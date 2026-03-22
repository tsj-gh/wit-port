import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeaderWithDevLinks } from "@/components/PageHeaderWithDevLinks";
import { ContactLink } from "@/components/ContactLink";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "Wispoのプライバシーポリシー。個人情報の取扱い、広告配信、クッキー（Cookie）、アクセス解析についてご説明します。",
  keywords: ["知育", "パズル", "無料", "プライバシーポリシー"],
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[720px] w-full px-6">
      <Suspense fallback={<header className="flex justify-between items-center py-8"><a href="/" className="text-wit-text font-black">Wispo</a><a href="/" className="text-wit-muted text-sm">← トップへ戻る</a></header>}>
        <PageHeaderWithDevLinks />
      </Suspense>

      <main className="pb-20">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-wit-text">
          プライバシーポリシー
        </h1>
        <p className="text-wit-muted text-sm mb-6">最終更新日：2026年</p>

        <article className="rounded-2xl p-6 sm:p-8 border border-white/10 bg-white/5 backdrop-blur">
          <p className="text-wit-muted leading-relaxed mb-6">
            Wispo（以下「当サイト」といいます。）は、本ウェブサイト上で提供するサービス（以下「本サービス」といいます。）における、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            1. 個人情報の定義
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報（個人識別情報）を指します。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            2. 個人情報の収集方法
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトでは、ユーザーがお問い合わせフォーム等を利用する際に、氏名やメールアドレス等の個人情報をお尋ねすることがあります。また、ユーザーが本サービスを利用する過程で、クッキー（Cookie）等の技術を通じてアクセスログを収集することがあります。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            3. 個人情報の利用目的
          </h2>
          <p className="text-wit-muted leading-relaxed mb-2">
            当サイトが個人情報を収集・利用する目的は、以下のとおりです。
          </p>
          <ul className="list-disc list-inside text-wit-muted space-y-2 mb-4">
            <li>本サービスの提供・運営のため</li>
            <li>ユーザーからのお問い合わせに回答するため（本人確認を行うことを含む）</li>
            <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
            <li>
              利用規約に違反したユーザーや、不正・不当な目的でサービスを利用しようとするユーザーの特定をし、ご利用をお断りするため
            </li>
            <li>上記の利用目的に付随する目的</li>
          </ul>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            4. 広告の配信について
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトでは、第三者配信事業者である「Google AdSense」を利用して広告を掲載しています。
          </p>
          <p className="text-wit-muted leading-relaxed mb-4">
            Googleなどの第三者配信事業者は、Cookieを使用して、ユーザーが当サイトや他のウェブサイトに過去にアクセスした際の情報に基づき、適切な広告を配信します。
          </p>
          <p className="text-wit-muted leading-relaxed mb-4">
            ユーザーは、Googleアカウントの広告設定で、パーソナライズ広告を無効にできます。
          </p>
          <p className="text-wit-muted leading-relaxed mb-4">
            また、
            <a
              href="https://www.aboutads.info"
              target="_blank"
              rel="noopener noreferrer"
              className="text-wit-accent hover:underline"
            >
              www.aboutads.info
            </a>
            にアクセスして、第三者配信事業者がパーソナライズ広告の掲載で使用するCookieを無効にすることもできます。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            5. アクセス解析ツールについて
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用しています。このGoogleアナリティクスはトラフィックデータの収集のためにクッキー（Cookie）を使用しています。トラフィックデータは匿名で収集されており、個人を特定するものではありません。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            6. 免責事項
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトのコンテンツ・情報について、可能な限り正確な情報を提供するよう努めておりますが、正確性や安全性を保証するものではありません。
          </p>
          <p className="text-wit-muted leading-relaxed mb-4">
            本サービスで提供されるパズル生成結果や数値データの正確性について、当サイトは一切の責任を負いません。
          </p>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。
          </p>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトからリンクやバナーなどによって他のサイトに移動された場合、移動先サイトで提供される情報、サービス等について一切の責任を負いません。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            7. プライバシーポリシーの変更
          </h2>
          <p className="text-wit-muted leading-relaxed mb-4">
            当サイトは、個人情報に関して適用される日本の法令を遵守するとともに、本ポリシーの内容を適宜見直しその改善に努めます。修正された最新のプライバシーポリシーは常に本ページにて開示されます。
          </p>

          <h2 className="text-lg font-bold mt-6 mb-3 text-wit-text">
            8. お問い合わせ窓口
          </h2>
          <p className="text-wit-muted leading-relaxed mb-2">
            本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。
          </p>
          <p className="text-wit-muted leading-relaxed mb-2">
            運営者：Wispo開発チーム
          </p>
          <p className="text-wit-muted leading-relaxed">
            <Suspense fallback={<a href="/contact" className="text-wit-accent hover:underline">https://wit-spot.vercel.app/contact</a>}>
              <ContactLink className="text-wit-accent hover:underline">
                https://wit-spot.vercel.app/contact
              </ContactLink>
            </Suspense>
          </p>
        </article>
      </main>
    </div>
  );
}
