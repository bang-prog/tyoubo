import { describe, expect, it } from 'vitest'
import {
  addOption,
  canonicalOption,
  buildCandidates,
  MAX_OPTIONS,
  normalizeOptionName,
  removeOption,
  sortSizes,
  toggleOption,
  usedOptionsOf,
} from './variantOptions'

describe('名前をそろえる', () => {
  it('全角の英数字は半角に、空白は前後を消して間を1つに', () => {
    expect(normalizeOptionName('Ｍ')).toBe('M')
    expect(normalizeOptionName(' １１号 ')).toBe('11号')
    expect(normalizeOptionName('ライト　ブルー')).toBe('ライト ブルー')
  })
})

describe('保存する名前', () => {
  it('決まった書き方のあるサイズは大文字にする。色や、ほかのサイズはそのまま', () => {
    expect(canonicalOption('ｍ', 'size')).toBe('M')
    expect(canonicalOption('xl', 'size')).toBe('XL')
    expect(canonicalOption('w28', 'size')).toBe('W28')
    expect(canonicalOption('f', 'size')).toBe('F')
    expect(canonicalOption('ワイド', 'size')).toBe('ワイド')
    expect(canonicalOption('m', 'color')).toBe('m')
  })

  it('追加するときも大文字にそろえる', () => {
    expect(addOption(['S'], 'ｌ', 'size')).toMatchObject({ ok: true, list: ['S', 'L'], name: 'L' })
  })
})

describe('追加・外す・タップ', () => {
  it('サイズは決まった順に並べ直す', () => {
    let list: string[] = []
    for (const s of ['L', 'S', 'M']) {
      const r = addOption(list, s, 'size')
      if (!r.ok) throw new Error(r.error)
      list = r.list
    }
    expect(list).toEqual(['S', 'M', 'L'])
  })

  it('色は追加した順のまま', () => {
    const r = addOption(['黒'], '白', 'color')
    expect(r.ok && r.list).toEqual(['黒', '白'])
  })

  it('空、長すぎる、もう入っている(全角や小文字でも)、多すぎるときは追加しない', () => {
    expect(addOption([], '  ', 'size')).toEqual({ ok: false, error: 'サイズを入力してください' })
    expect(addOption([], 'あ'.repeat(21), 'color')).toMatchObject({ ok: false, error: '色は20文字までにしてください' })
    expect(addOption(['M'], 'Ｍ', 'size')).toMatchObject({ ok: false, error: 'サイズ「M」はもう入っています' })
    expect(addOption(['M'], 'm', 'size')).toMatchObject({ ok: false })
    const many = Array.from({ length: MAX_OPTIONS.size }, (_, i) => `${i + 1}`)
    expect(addOption(many, 'XL', 'size')).toEqual({ ok: false, error: 'サイズは20個までです' })
  })

  it('入っていれば外し、なければ追加する', () => {
    expect(toggleOption(['S', 'M'], 'M', 'size')).toMatchObject({ ok: true, list: ['S'] })
    expect(toggleOption(['S'], 'L', 'size')).toMatchObject({ ok: true, list: ['S', 'L'] })
    expect(removeOption(['白', '黒'], '白')).toEqual(['黒'])
  })
})

describe('サイズの並び順', () => {
  it('アルファベット → 号数 → 数字 → フリー。並びのないものは追加した順で最後', () => {
    expect(sortSizes(['F', '9号', 'XL', '2', 'S', '7号', '1', 'ワイド', 'XS', 'スリム'])).toEqual([
      'XS',
      'S',
      'XL',
      '7号',
      '9号',
      '1',
      '2',
      'F',
      'ワイド',
      'スリム',
    ])
  })

  it('数字は数の大きさで並べる(文字の順ではない)', () => {
    expect(sortSizes(['25.5', '9', '24', '10'])).toEqual(['9', '10', '24', '25.5'])
    expect(sortSizes(['W32', 'w28', 'W30'])).toEqual(['w28', 'W30', 'W32'])
  })
})

describe('候補', () => {
  it('ほかの商品で使ったものを、多く使われている順に集める', () => {
    const used = usedOptionsOf([
      { sizes: ['S', 'M'], colors: ['白', '杢グレー'] },
      { sizes: ['M', 'L'], colors: ['杢グレー'] },
      { sizes: ['Ｍ'], colors: ['黒'] },
    ])
    expect(used.sizes).toEqual(['M', 'S', 'L'])
    expect(used.colors).toEqual(['杢グレー', '白', '黒'])
  })

  it('プリセット → ほかの商品で使ったもの → この商品で追加したもの。同じものは1回だけ', () => {
    const groups = buildCandidates('color', ['白', '杢グレー', 'ボルドー'], ['杢グレー', '黒'])
    expect(groups.map((g) => g.label)).toEqual(['よく使う色', 'ほかの商品で使ったもの', 'この商品で追加したもの'])
    const preset = groups[0].candidates
    expect(preset.find((c) => c.name === '白')).toEqual({ name: '白', selected: true, source: 'preset' })
    expect(preset.find((c) => c.name === '黒')).toMatchObject({ selected: false })
    // 黒はプリセットにあるので「使ったもの」には出ない
    expect(groups[1].candidates).toEqual([{ name: '杢グレー', selected: true, source: 'used' }])
    expect(groups[2].candidates).toEqual([{ name: 'ボルドー', selected: true, source: 'added' }])
  })

  it('サイズはグループごとに出し、空のグループは出さない', () => {
    const groups = buildCandidates('size', ['M'], [])
    expect(groups.map((g) => g.label)).toEqual(['アルファベット', 'フリー', '号数', '数字'])
    expect(groups[0].candidates.filter((c) => c.selected).map((c) => c.name)).toEqual(['M'])
  })
})
