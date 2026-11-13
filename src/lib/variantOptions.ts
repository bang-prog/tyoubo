// 商品のサイズと色の選び方(商品管理)。
// カンマで区切って打つ代わりに、候補をタップして選び、候補にないものは1つずつ追加する。
// 候補 = よく使うもの(プリセット) + ほかの商品で使ったもの。画面にも DB にも依存しない計算だけを置く。

export type OptionKind = 'size' | 'color'

/** 1つの名前の長さの上限 */
export const MAX_OPTION_LENGTH = 20
/** 1つの商品に付けられる数の上限(サイズ × 色の組み合わせが多くなりすぎないように) */
export const MAX_OPTIONS: Record<OptionKind, number> = { size: 20, color: 30 }

const LABELS: Record<OptionKind, string> = { size: 'サイズ', color: '色' }

/** サイズの候補。グループごとに並べて出す */
export const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: 'アルファベット', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'フリー', sizes: ['F'] },
  { label: '号数', sizes: ['5号', '7号', '9号', '11号', '13号', '15号'] },
  { label: '数字', sizes: ['0', '1', '2', '3', '4'] },
]

/** 色の候補 */
export const COLOR_PRESETS: string[] = [
  '白',
  'アイボリー',
  'ベージュ',
  'グレー',
  '黒',
  'ネイビー',
  'ブラウン',
  'カーキ',
  'グリーン',
  'ブルー',
  'サックス',
  'レッド',
  'ピンク',
  'イエロー',
  'オレンジ',
  'パープル',
]

/**
 * 入力した名前をそろえる。全角の英数字は半角に(「Ｍ」→「M」)、前後の空白は消し、間の空白は1つにする。
 * 半角カナなども NFKC で全角にそろう。
 */
export function normalizeOptionName(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

/** 大文字で書くと決まっているサイズ */
const UPPERCASE_SIZES = new Set(['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3L', '4L', '5L', 'F'])

/**
 * 保存する名前にそろえる。normalizeOptionName に加えて、決まった書き方のあるサイズは大文字にする
 * (「ｍ」「m」→「M」、「w28」→「W28」)。
 */
export function canonicalOption(text: string, kind: OptionKind): string {
  const name = normalizeOptionName(text)
  if (kind !== 'size') return name
  const upper = name.toUpperCase()
  return UPPERCASE_SIZES.has(upper) || /^W\d+$/.test(upper) ? upper : name
}

/** 同じものかを比べるためのキー。大文字・小文字は区別しない(「m」と「M」は同じサイズ) */
export function optionKey(name: string): string {
  return normalizeOptionName(name).toLowerCase()
}

export function hasOption(list: string[], name: string): boolean {
  const key = optionKey(name)
  return list.some((v) => optionKey(v) === key)
}

export type AddResult = { ok: true; list: string[]; name: string } | { ok: false; error: string }

/**
 * 1つ追加する。空、長すぎる、すでにある、数が多すぎるときは追加しない。
 * サイズは決まった順(XS → S → M …)に並べ直し、色は追加した順のまま後ろに足す。
 */
export function addOption(list: string[], input: string, kind: OptionKind): AddResult {
  const label = LABELS[kind]
  const name = canonicalOption(input, kind)
  if (!name) return { ok: false, error: `${label}を入力してください` }
  if (name.length > MAX_OPTION_LENGTH) return { ok: false, error: `${label}は${MAX_OPTION_LENGTH}文字までにしてください` }
  if (hasOption(list, name)) return { ok: false, error: `${label}「${name}」はもう入っています` }
  if (list.length >= MAX_OPTIONS[kind]) return { ok: false, error: `${label}は${MAX_OPTIONS[kind]}個までです` }
  const next = [...list, name]
  return { ok: true, list: kind === 'size' ? sortSizes(next) : next, name }
}

/** 1つ外す */
export function removeOption(list: string[], name: string): string[] {
  const key = optionKey(name)
  return list.filter((v) => optionKey(v) !== key)
}

/** 候補をタップしたとき。入っていれば外し、なければ追加する */
export function toggleOption(list: string[], name: string, kind: OptionKind): AddResult {
  if (hasOption(list, name)) return { ok: true, list: removeOption(list, name), name: normalizeOptionName(name) }
  return addOption(list, name, kind)
}

// ---------- サイズの並び順 ----------

const LETTER_ORDER = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3L', 'XXXL', '4L', '5L']

/**
 * サイズの並び順の目安。小さいほど先。決まった並びがないサイズは null(追加した順のまま後ろに置く)。
 * アルファベット → 号数 → 数字 → ウエスト(W28 など)→ フリーの順。
 */
function sizeRank(size: string): number | null {
  const s = normalizeOptionName(size).toUpperCase()
  const letter = LETTER_ORDER.indexOf(s)
  if (letter >= 0) return letter
  const go = /^(\d+(?:\.\d+)?)号$/.exec(s)
  if (go) return 1000 + Number(go[1])
  if (/^\d+(?:\.\d+)?$/.test(s)) return 2000 + Number(s)
  const waist = /^W(\d+)$/.exec(s)
  if (waist) return 3000 + Number(waist[1])
  if (s === 'F' || s === 'FREE' || s === 'フリー') return 9000
  return null
}

/** サイズを決まった順に並べる。決まった並びがないものは、追加した順のまま最後に置く */
export function sortSizes(sizes: string[]): string[] {
  const ranked = sizes.map((size, index) => ({ size, index, rank: sizeRank(size) }))
  return ranked
    .sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank || a.index - b.index
      if (a.rank !== null) return -1
      if (b.rank !== null) return 1
      return a.index - b.index
    })
    .map((r) => r.size)
}

// ---------- 候補 ----------

/** ほかの商品で使ったサイズと色。使った商品の多い順 */
export type UsedOptions = { sizes: string[]; colors: string[] }

/** 登録済みの商品から、使ったサイズと色を集める(多く使われている順。同じ数なら先に出てきた順) */
export function usedOptionsOf(products: { sizes: string[]; colors: string[] }[]): UsedOptions {
  const count = (pick: (p: { sizes: string[]; colors: string[] }) => string[]) => {
    const counts = new Map<string, { name: string; n: number; first: number }>()
    let order = 0
    for (const p of products) {
      for (const name of new Set(pick(p).map(normalizeOptionName))) {
        const key = optionKey(name)
        const c = counts.get(key)
        if (c) c.n += 1
        else counts.set(key, { name, n: 1, first: order++ })
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.first - b.first).map((c) => c.name)
  }
  return { sizes: count((p) => p.sizes), colors: count((p) => p.colors) }
}

export type Candidate = {
  name: string
  selected: boolean
  /** preset:よく使うもの / used:ほかの商品で使ったもの / added:この商品で追加したもの */
  source: 'preset' | 'used' | 'added'
}

export type CandidateGroup = { label: string; candidates: Candidate[] }

/**
 * 画面に並べる候補。プリセット、ほかの商品で使ったもの、この商品で追加したものの順にグループで返す。
 * 同じものは1回だけ出す(先に出たグループに入れる)。選んでいるものには selected を付ける。
 */
export function buildCandidates(kind: OptionKind, selected: string[], used: string[]): CandidateGroup[] {
  const seen = new Set<string>()
  const take = (names: string[], source: Candidate['source']): Candidate[] => {
    const out: Candidate[] = []
    for (const raw of names) {
      const name = normalizeOptionName(raw)
      const key = optionKey(name)
      if (!name || seen.has(key)) continue
      seen.add(key)
      out.push({ name, selected: hasOption(selected, name), source })
    }
    return out
  }

  const groups: CandidateGroup[] =
    kind === 'size'
      ? SIZE_PRESETS.map((g) => ({ label: g.label, candidates: take(g.sizes, 'preset') }))
      : [{ label: 'よく使う色', candidates: take(COLOR_PRESETS, 'preset') }]
  groups.push({ label: 'ほかの商品で使ったもの', candidates: take(used, 'used') })
  // 選んでいるのに候補にないもの(この商品で追加したもの)も、外せるように出す
  groups.push({ label: 'この商品で追加したもの', candidates: take(selected, 'added') })
  return groups.filter((g) => g.candidates.length > 0)
}
