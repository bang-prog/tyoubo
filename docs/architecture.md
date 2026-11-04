# レジ帳簿 アーキテクチャ

- 更新:2026-11-04(ステップ⑦まで実装済み)
- 仕様:[spec.md](spec.md)

図は Mermaid で書いています。GitHub ではそのまま図として表示されます。

---

## 1. 全体の構成

サーバーは画面のファイルを配るだけです。**データはお店の端末のブラウザの中(IndexedDB)にだけ保存し、外には送りません。**

```mermaid
flowchart LR
  dev["開発用の PC<br/>コードを書く"] -- "git push" --> gh["GitHub<br/>bang-prog/tyoubo"]
  gh -- "自動デプロイ(予定)" --> cf["Cloudflare Pages<br/>画面のファイルを配る"]

  subgraph device["お店の端末(iPad または PC)"]
    browser["ブラウザ<br/>レジ帳簿アプリ"]
    idb[("IndexedDB<br/>商品・在庫・会計・設定")]
    browser <--> idb
  end

  cf -- "開いたとき・更新したときだけ" --> browser
  browser -- "Excel・バックアップ(予定)" --> files["端末のファイル<br/>ファイルアプリ・フォルダ"]
```

| 部分 | 使っているもの | 状態 |
|---|---|---|
| 画面 | React + TypeScript(Vite でビルド) | 実装中 |
| データの保存 | IndexedDB(Dexie.js で操作) | 実装中 |
| 画面のファイルの配信 | Cloudflare Pages | 予定 |
| Excel の出力 | ExcelJS | 予定 |

---

## 2. コードの層

上の層は下の層を使いますが、下の層は上の層を知りません。計算(`src/lib`)は画面にもデータベースにも依存しないので、テストだけで正しさを確かめられます。

```mermaid
flowchart TB
  subgraph ui["画面  src/pages・src/components"]
    shell["AppShell<br/>タブ・時計"]
    reg["会計<br/>RegisterPage"]
    prod["商品管理<br/>ProductsPage"]
    rest["会計履歴・レジ締め・帳簿・設定<br/>(今は枠だけ)"]
  end

  subgraph state["画面をまたいで持つ状態  src/state"]
    cartctx["CartProvider<br/>カートの中身"]
  end

  subgraph data["データの処理  src/db"]
    catalog["catalog.ts<br/>カテゴリー・商品・在庫"]
    sales["sales.ts<br/>会計の保存"]
    settings["settings.ts<br/>設定"]
    schema["db.ts<br/>テーブルの定義"]
  end

  subgraph lib["計算  src/lib(画面にも DB にも依存しない)"]
    money["money.ts<br/>税・お釣り"]
    cash["cashInput.ts<br/>電卓の入力"]
    cartlib["cart.ts<br/>カートの計算"]
    time["time.ts<br/>日時・営業日"]
  end

  idb[("IndexedDB")]

  reg --> cartctx
  reg -- "表示:useLiveQuery" --> catalog
  reg -- "会計の確定" --> sales
  prod -- "表示・保存" --> catalog
  ui --> lib
  cartctx --> cartlib
  catalog --> schema
  sales --> schema
  settings --> schema
  sales --> money
  sales --> time
  schema --> idb
```

| フォルダ | 役割 | 主なファイル |
|---|---|---|
| `src/pages` | タブごとの画面 | `RegisterPage`、`ProductsPage` |
| `src/components` | 画面の部品 | `AppShell`、`Modal`、`PayDialog`(電卓)、`ChangeDialog`(完了)、`register/*`、`products/*` |
| `src/state` | タブを切り替えても残す状態 | `CartProvider`(カート) |
| `src/db` | データの保存・読み込み。入力のチェックとトランザクションもここ | `db.ts`、`catalog.ts`、`sales.ts`、`settings.ts`、`errors.ts` |
| `src/lib` | 計算だけの関数 | `money.ts`、`cashInput.ts`、`cart.ts`、`time.ts`、`labels.ts` |
| `src/styles` | 色・文字・共通の部品の見た目 | `global.css` |

**決まりごと**
- 画面から IndexedDB を直接さわらない。必ず `src/db` の関数を通す。
- 入力のチェックは `src/db` の関数の中で行う。どの画面から保存しても同じ決まりが守られる。
- 画面の表示は `useLiveQuery` で読む。保存するとデータベースが変わり、画面は自動で描き直される。
- 金額はすべて円単位の整数で扱う。

---

## 3. データの構造

```mermaid
erDiagram
  categories ||--o{ products : "分類する"
  products ||--|{ variants : "サイズ×色"
  sales ||--|{ saleItems : "明細"
  variants ||--o{ saleItems : "売れた"
  sales ||--o{ refunds : "返品"
  refunds ||--|{ refundItems : "返品の明細"
  saleItems ||--o{ refundItems : "返品した明細"

  categories {
    string id PK
    string name
    number sortOrder
  }
  products {
    string id PK
    string categoryId FK
    string name
    number priceIncl "税込"
    number cost
    boolean isActive "false で削除済み"
  }
  variants {
    string id PK
    string productId FK
    string size
    string color
    number stock "マイナスもあり"
    boolean isActive
  }
  sales {
    string id PK
    string saleNo "YYYYMMDD-NNN"
    string businessDate
    number totalIncl
    number taxAmount
    number received
    number change
  }
  saleItems {
    string id PK
    string saleId FK
    string variantId FK
    string productName "会計時点の値"
    number unitPriceIncl
    number qty
    number returnedQty
  }
  refunds {
    string id PK
    string saleId FK
    string businessDate "返品した日"
    number amountIncl
  }
  refundItems {
    string id PK
    string refundId FK
    string saleItemId FK
    number qty
  }
  closings {
    string businessDate PK
    number openingFloat
    number countedTotal
    number difference
  }
  settings {
    string key PK
    any value
  }
```

- 商品やサイズ・色は消さずに `isActive: false` にする(論理削除)。過去の売上が参照しているため。
- 会計の明細には、商品名・カテゴリー名・価格を会計した時点の値で書き写す。あとで商品を編集しても、過去の帳簿が変わらない。
- `refunds`、`refundItems`、`closings` はテーブルだけ用意してあり、使うのはステップ⑨・⑩から。

---

## 4. 会計の流れ(ステップ⑦)

```mermaid
sequenceDiagram
  actor owner as オーナー
  participant reg as 会計画面
  participant cart as カート(CartProvider)
  participant pay as 電卓画面
  participant sales as sales.ts
  participant idb as IndexedDB

  owner->>reg: 商品をタップ(サイズ・色を選ぶ)
  reg->>cart: 追加(どのサイズ・色を何点)
  Note over reg: 在庫を超えたら警告(会計はできる)
  owner->>pay: お預かりを入力
  pay->>reg: 会計を確定
  reg->>sales: createSale(カート, お預かり, 画面の合計)
  sales->>idb: トランザクションを始める
  sales->>idb: 今の価格で合計を計算し直す
  alt 合計が違う・お預かりが足りない・削除された商品がある
    sales-->>reg: エラー(何も保存しない)
    reg-->>owner: 電卓画面にエラーを表示(カートは残す)
  else 問題なし
    sales->>idb: 会計番号を振る
    sales->>idb: 会計と明細を保存
    sales->>idb: 在庫を減らす
    sales-->>reg: 保存した会計
    reg->>cart: カートを空にする
    reg-->>owner: お釣りと会計番号を表示
  end
  Note over reg,idb: 在庫が減ると useLiveQuery で商品カードの在庫も自動で更新される
```

---

## 5. 実装の状況

| # | 機能 | 主なファイル | 状態 |
|---|---|---|---|
| 1 | プロジェクトの準備 | `package.json`、`vite.config.ts`、`eslint.config.js` | ✅ |
| 2 | 金額計算 | `src/lib/money.ts` | ✅ |
| 3 | 画面の枠 | `src/components/AppShell.tsx` | ✅ |
| 4 | 電卓画面 | `src/components/PayDialog.tsx`、`src/lib/cashInput.ts` | ✅ |
| 5 | データの土台 | `src/db/db.ts`、`src/db/types.ts`、`src/db/settings.ts` | ✅ |
| 6 | 商品管理 | `src/db/catalog.ts`、`src/components/products/*` | ✅ |
| 7 | 会計 | `src/db/sales.ts`、`src/lib/cart.ts`、`src/components/register/*` | ✅ |
| 8 | 会計履歴 | | ⬜ |
| 9 | 返品 | | ⬜ |
| 10 | レジ締め | | ⬜ |
| 11 | 帳簿と Excel 出力 | | ⬜ |
| 12 | 設定(暗証番号、バックアップ、古いデータの削除) | | ⬜ |
| 13 | PWA と実機での確認 | | ⬜ |
