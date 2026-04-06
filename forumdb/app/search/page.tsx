import { searchPosts } from '@/lib/queries'
import { createClient } from '@/lib/supabase'
import PostCard from '@/components/PostCard'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const query    = searchParams.q ?? ''
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const results = query ? await searchPosts(query).catch(() => []) : []

  return (
    <div className="max-w-3xl space-y-4">
      <div className="text-sm text-gray-500">
        {query
          ? `${results.length} results for "${query}"`
          : 'Enter a search term above'}
      </div>
      <div className="space-y-3">
        {results.map((p: any) => (
          <PostCard key={p.id} post={p} userId={user?.id ?? null} />
        ))}
      </div>
    </div>
  )
}