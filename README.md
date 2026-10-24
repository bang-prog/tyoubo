# レジ帳簿

個人経営の洋服店向けの、現金会計用レジ・帳簿 Web アプリ。

- 仕様書:[docs/spec.md](docs/spec.md)
- 画面モック:[mockup/index.html](mockup/index.html)(ブラウザで開く。データはサンプル)

## 技術スタック

TypeScript / React + Vite / IndexedDB(Dexie.js) / ExcelJS / Cloudflare Pages

データは端末のブラウザの中にだけ保存し、クラウドには送らない。

詳しくは仕様書の「4. 技術スタック」を参照。

## 開発

Node.js 24 以上が必要。

```bash
npm install        # 最初に1回
npm run dev        # 開発用サーバーを起動する
npm run test       # テストを実行する(ファイルを保存するたびに再実行)
npm run test:run   # テストを1回だけ実行する
npm run lint       # ESLint
npm run typecheck  # 型チェック
npm run build      # 本番用にビルドする(dist/ に出力)
```
