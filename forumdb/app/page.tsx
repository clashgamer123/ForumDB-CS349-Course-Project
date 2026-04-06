import { createClient } from '@/lib/supabase'
import { getFeedPosts } from '@/lib/queries'
import PostCard from '@/components/PostCard'
import FeedTabs from '@/components/FeedTabs'
import Link from 'next/link'
import type { FeedSort } from '@/lib/types'

export default async function HomePage({
  searchParams,
}: {
  searchParams: { sort?: string }
}) {
const {sort : rawSort} = await searchParams
  const sort   = (searchParams.sort ?? 'hot') as FeedSort
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const posts = await getFeedPosts(sort, undefined, user?.id).catch(() => [])

  return (
    <div className="flex gap-6">
      {/* Feed */}
      <div className="flex-1 space-y-3">
        <FeedTabs current={sort} />
        {posts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md p-8 text-center text-gray-500">
            No posts yet. <Link href="/submit" className="text-orange-500 hover:underline">
              Be the first to post!
            </Link>
          </div>
        ) : (
          posts.map(p => <PostCard key={p.id} post={p} userId={user?.id ?? null} />)
        )}
      </div>

      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden md:block space-y-3">
        <div className="bg-orange-500 text-white rounded-md p-4">
          <h2 className="font-bold text-base mb-1">Welcome to ForumDB</h2>
          <p className="text-sm text-orange-100 mb-3">
            A community discussion platform powered by PostgreSQL.
          </p>
          {!user && (
            <Link href="/login"
              className="block text-center bg-white text-orange-500 font-semibold
                rounded-full py-1.5 text-sm hover:bg-orange-50">
              Get Started
            </Link>
          )}
        </div>
        <CommunityList />
      </aside>
    </div>
  )
}

async function CommunityList() {
  const supabase = createClient()
  const { data } = await supabase
    .from('communities')
    .select('name, display_name, member_count')
    .order('member_count', { ascending: false })
    .limit(8)

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3">
      <h3 className="font-semibold text-sm text-gray-700 mb-2">Communities</h3>
      <div className="space-y-1">
        {(data ?? []).map(c => (
          <Link key={c.name} href={`/r/${c.name}`}
            className="flex items-center justify-between text-sm py-1
              hover:text-orange-500">
            <span className="font-medium">r/{c.name}</span>
            <span className="text-xs text-gray-400">{c.member_count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}