# レジ帳簿

個人経営の洋服店向けの、現金会計用レジ・帳簿 Web アプリ。

- 仕様書:[docs/spec.md](docs/spec.md)
- 画面モック:[mockup/index.html](mockup/index.html)(ブラウザで開く。データはサンプル)

## 技術スタック

TypeScript / React + Vite / IndexedDB(Dexie.js) / ExcelJS / Cloudflare Pages

データは端末のブラウザの中にだけ保存し、クラウドには送らない。

詳しくは仕様書の「4. 技術スタック」を参照。
