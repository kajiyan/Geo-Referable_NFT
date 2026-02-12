'use client'

import { useState, useEffect } from 'react'

/**
 * クライアントサイドでURLフラグメント（#以降）を取得するフック
 *
 * @returns フラグメント文字列（#なし）、またはフラグメントがない場合はnull
 *
 * @example
 * // URL: /history/amoy/0x123.../1#42
 * const fragment = useHashFragment() // "42"
 */
export function useHashFragment(): string | null {
  // 遅延初期化で初回レンダリング時に同期的にハッシュを読み取る
  // これにより、useEffect を待たずに最初のレンダリングでハッシュが利用可能になる
  const [fragment, setFragment] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1) // # を除去
      return hash || null
    }
    return null
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // hashchange イベントをリッスン（動的なハッシュ変更対応）
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      setFragment(hash || null)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return fragment
}

export default useHashFragment
