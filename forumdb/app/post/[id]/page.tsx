import { createClient } from '@/lib/supabase'
import { getPostById, getCommentTree } from '@/lib/queries'
import VoteButtons from '@/components/VoteButtons'
import CommentThread from '@/components/CommentThread'
import CommentBox from './CommentBox'
import { notFound } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default async function PostPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const post     = await getPostById(params.id, user?.id)
  if (!post) notFound()

  const comments = await getCommentTree(params.id, user?.id)
  const age      = formatDistanceToNow(new Date(post.created_at), { addSuffix: true })

  return (
    <div className="max-w-3xl space-y-4">
      {/* Post */}
      <div className="bg-white border border-gray-200 rounded-md p-4 flex gap-4">
        <VoteButtons
          targetId={post.id}
          type="post"
          score={post.score}
          userVote={post.user_vote ?? null}
          userId={user?.id ?? null}
        />
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-2 flex gap-1.5">
            <Link href={`/r/${post.community?.name}`}
              className="font-semibold text-gray-700 hover:underline">
              r/{post.community?.name}
            </Link>
            <span>•</span>
            <span>u/{post.author?.username}</span>
            <span>•</span>
            <span>{age}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">{post.title}</h1>
          {post.url && (
            <a href={post.url} target="_blank" rel="noopener noreferrer"
              className="text-blue-500 text-sm hover:underline block mb-3">
              {post.url}
            </a>
          )}
          {post.body && (
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{post.body}</p>
          )}
        </div>
      </div>

      {/* Comment box */}
      {user ? (
        <CommentBox postId={params.id} userId={user.id} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-sm text-gray-600">
          <Link href="/login" className="text-orange-500 hover:underline">Log in</Link> to comment
        </div>
      )}

      {/* Comments */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <h2 className="font-semibold text-gray-700 mb-4 text-sm">
          {post.comment_count} Comments
        </h2>
        <CommentThread comments={comments} userId={user?.id ?? null} postId={params.id} />
      </div>
    </div>
  )
}