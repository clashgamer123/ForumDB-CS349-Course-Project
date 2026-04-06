'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Community } from '@/lib/types'

export default function SubmitPage() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [community,   setCommunity]   = useState('')
  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [url,         setUrl]         = useState('')
  const [tab,         setTab]         = useState<'text' | 'link'>('text')
  const [loading,     setLoading]     = useState(false)
  const router      = useRouter()
  const supabase    = createClient()
  const searchParams = useSearchParams()

  useEffect(() => {
    supabase.from('communities').select('*').order('name')
      .then(({ data }) => {
        setCommunities(data ?? [])
        const preset = searchParams.get('community')
        if (preset) setCommunity(preset)
        else if (data?.[0]) setCommunity(data[0].name)
      })
  }, [])

  const submit = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: comm } = await supabase
      .from('communities')
      .select('id')
      .eq('name', community)
      .single()
    if (!comm) return

    setLoading(true)
    const { data: post, error } = await supabase.from('posts').insert({
      title:        title.trim(),
      body:         tab === 'text' ? body.trim() || null : null,
      url:          tab === 'link' ? url.trim()  || null : null,
      author_id:    user.id,
      community_id: comm.id,
    }).select('id').single()

    setLoading(false)
    if (!error && post) router.push(`/post/${post.id}`)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Create a Post</h1>

      <select value={community} onChange={e => setCommunity(e.target.value)}
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm
          focus:outline-none focus:border-orange-400">
        {communities.map(c => (
          <option key={c.name} value={c.name}>r/{c.name}</option>
        ))}
      </select>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="flex border-b border-gray-200">
          {(['text', 'link'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium capitalize
                ${tab === t ? 'border-b-2 border-orange-500 text-orange-600'
                            : 'text-gray-500 hover:text-gray-700'}`}>
              {t} Post
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)}
            maxLength={300}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm
              focus:outline-none focus:border-orange-400" />

          {tab === 'text' ? (
            <textarea placeholder="Text (optional)" value={body}
              onChange={e => setBody(e.target.value)} rows={6}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm
                resize-none focus:outline-none focus:border-orange-400" />
          ) : (
            <input placeholder="URL" value={url} onChange={e => setUrl(e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm
                focus:outline-none focus:border-orange-400" />
          )}

          <div className="flex justify-end">
            <button onClick={submit} disabled={loading || !title.trim()}
              className="bg-orange-500 text-white px-6 py-1.5 rounded-full text-sm
                font-semibold hover:bg-orange-600 disabled:opacity-50">
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}