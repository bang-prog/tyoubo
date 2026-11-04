import { useMemo, useReducer, type ReactNode } from 'react'
import { cartReducer } from '../lib/cart'
import { CartContext } from './CartContext'

/**
 * カートの中身をアプリ全体で持つ。会計画面の外に置くので、
 * 会計の途中で別のタブを開いて戻ってもカートは消えない(アプリを閉じると消える)。
 */
export default function CartProvider({ children }: { children: ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, [])
  const value = useMemo(() => ({ lines, dispatch }), [lines])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
