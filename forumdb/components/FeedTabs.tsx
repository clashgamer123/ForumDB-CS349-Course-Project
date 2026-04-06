'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Flame, Clock, TrendingUp, Zap } from 'lucide-react'
import type { FeedSort } from '@/lib/types'

const tabs: { label: string; value: FeedSort; icon: React.ReactNode }[] = [
  { label: 'Hot',           value: 'hot',           icon: <Flame size={14} /> },
  { label: 'New',           value: 'new',           icon: <Clock size={14} /> },
  { label: 'Top',           value: 'top',           icon: <TrendingUp size={14} /> },
  { label: 'Controversial', value: 'controversial', icon: <Zap size={14} /> },
]

export default function FeedTabs({ current }: { current: FeedSort }) {
  const router      = useRouter()
  const searchParams = useSearchParams()

  const go = (sort: FeedSort) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sort)
    router.push('?' + params.toString())
  }

  return (
    <div className="flex gap-1 bg-white border border-gray-200 rounded-md p-1 w-fit">
      {tabs.map(t => (
        <button key={t.value} onClick={() => go(t.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium
            transition-colors ${current === t.value
              ? 'bg-orange-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'}`}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )
}