'use client'
import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface Props {
  targetId:   string
  type:       'post' | 'comment'
  score:      number
  userVote:   number | null
  userId:     string | null
}

export default function VoteButtons({ targetId, type, score, userVote, userId }: Props) {
  const [currentVote,  setCurrentVote]  = useState<number | null>(userVote)
  const [currentScore, setCurrentScore] = useState(score)
  const supabase = createClient()

  const vote = async (value: 1 | -1) => {
    if (!userId) return

    const table    = type === 'post' ? 'post_votes'    : 'comment_votes'
    const idColumn = type === 'post' ? 'post_id'       : 'comment_id'
    const newVote  = currentVote === value ? null : value
    const delta    = (newVote ?? 0) - (currentVote ?? 0)

    setCurrentVote(newVote)
    setCurrentScore(s => s + delta)

    if (newVote === null) {
      await supabase.from(table)
        .delete()
        .eq('user_id', userId)
        .eq(idColumn, targetId)
    } else if (currentVote === null) {
      await supabase.from(table)
        .insert({ user_id: userId, [idColumn]: targetId, value: newVote })
    } else {
      await supabase.from(table)
        .update({ value: newVote })
        .eq('user_id', userId)
        .eq(idColumn, targetId)
    }
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button onClick={() => vote(1)}
        className={`p-0.5 rounded hover:bg-orange-100 transition-colors
          ${currentVote === 1 ? 'text-orange-500' : 'text-gray-400'}`}>
        <ChevronUp size={18} />
      </button>
      <span className={`text-xs font-bold
        ${currentVote === 1 ? 'text-orange-500' : currentVote === -1 ? 'text-blue-500' : 'text-gray-600'}`}>
        {currentScore}
      </span>
      <button onClick={() => vote(-1)}
        className={`p-0.5 rounded hover:bg-blue-100 transition-colors
          ${currentVote === -1 ? 'text-blue-500' : 'text-gray-400'}`}>
        <ChevronDown size={18} />
      </button>
    </div>
  )
}