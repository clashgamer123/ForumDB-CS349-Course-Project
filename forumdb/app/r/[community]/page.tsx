import { createClient } from '@/lib/supabase'
import { getFeedPosts } from '@/lib/queries'
import PostCard from '@/components/PostCard'
import FeedTabs from '@/components/FeedTabs'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { FeedSort } from '@/lib/types'

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params:       Promise<{ community: string }>
  searchParams: Promise<{ sort?: string }>
}) {
  const { community } = await params
  const { sort: rawSort } = await searchParams
  const supabase = createClient()
  const sort     = (rawSort ?? 'hot') as FeedSort

  const { data: communityData } = await supabase
    .from('communities')
    .select('*')
    .eq('name', community)
    .single()

  if (!community) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const posts = await getFeedPosts(sort, community, user?.id).catch(() => [])

  return (
    <div className="space-y-4">
      {/* Community header */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-orange-400 to-orange-600" />
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">r/{communityData.name}</h1>
            <p className="text-sm text-gray-500">{communityData.description}</p>
          </div>
          {user && (
            <Link href={`/r/${communityData.name}/submit`}
              className="bg-orange-500 text-white text-sm px-4 py-1.5 rounded-full
                hover:bg-orange-600 font-medium">
              + Post
            </Link>
          )}
        </div>
      </div>

      <FeedTabs current={sort} />

      <div className="space-y-3">
        {posts.map(p => <PostCard key={p.id} post={p} userId={user?.id ?? null} />)}
      </div>
    </div>
  )
}