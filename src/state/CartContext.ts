import { createContext, useContext, type Dispatch } from 'react'
import type { CartAction, CartLine } from '../lib/cart'

export type CartContextValue = { lines: CartLine[]; dispatch: Dispatch<CartAction> }

export const CartContext = createContext<CartContextValue | null>(null)

/** カートの中身と、カートを変える dispatch。CartProvider の中で使う。 */
export function useCart(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart は CartProvider の中で使ってください')
  return value
}
