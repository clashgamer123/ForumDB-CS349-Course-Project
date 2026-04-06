'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function CommentBox({ postId, userId }: { postId: string; userId: string }) {
  const [body,    setBody]    = useState('')
  const [loading, setLoading] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  const submit = async () => {
    if (!body.trim()) return
    setLoading(true)
    await supabase.from('comments').insert({
      body:      body.trim(),
      post_id:   postId,
      author_id: userId,
      depth:     0,
    })
    setBody('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 space-y-2">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="What are your thoughts?"
        rows={4}
        className="w-full text-sm border border-gray-200 rounded p-2 resize-none
          focus:outline-none focus:border-orange-400"
      />
      <div className="flex justify-end">
        <button onClick={submit} disabled={loading || !body.trim()}
          className="bg-orange-500 text-white text-sm px-4 py-1.5 rounded-full
            font-medium hover:bg-orange-600 disabled:opacity-50">
          {loading ? 'Posting...' : 'Comment'}
        </button>
      </div>
    </div>
  )
}