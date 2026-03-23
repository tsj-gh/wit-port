import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-wit-bg to-wit-bg-2 text-wit-text">
      <main className="text-center max-w-md">
        <h1 className="text-6xl font-black text-wit-muted/50 mb-4">404</h1>
        <h2 className="text-xl font-bold mb-4 text-wit-text">ページが見つかりません</h2>
        <p className="text-wit-muted text-sm leading-relaxed mb-8">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl bg-wit-accent hover:bg-blue-600 text-white font-medium transition-colors no-underline"
        >
          トップページへ戻る
        </Link>
      </main>
    </div>
  );
}
