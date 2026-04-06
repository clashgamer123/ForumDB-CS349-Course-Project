import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, ExternalLink } from 'lucide-react'
import VoteButtons from './VoteButtons'
import type { Post } from '@/lib/types'

interface Props {
  post:   Post
  userId: string | null
}

export default function PostCard({ post, userId }: Props) {
  const age = formatDistanceToNow(new Date(post.created_at), { addSuffix: true })

  return (
    <div className="flex gap-3 bg-white border border-gray-200 rounded-md p-3
      hover:border-gray-400 transition-colors">
      <VoteButtons
        targetId={post.id}
        type="post"
        score={post.score}
        userVote={post.user_vote ?? null}
        userId={userId}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Link href={`/r/${post.community?.name}`}
            className="font-semibold text-gray-700 hover:underline">
            r/{post.community?.name}
          </Link>
          <span>•</span>
          <span>Posted by u/{post.author?.username}</span>
          <span>•</span>
          <span>{age}</span>
        </div>

        <Link href={`/post/${post.id}`}>
          <h2 className="font-semibold text-gray-900 hover:text-orange-600
            leading-snug mb-1">
            {post.title}
          </h2>
        </Link>

        {post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:underline mb-1">
            <ExternalLink size={11} />
            {new URL(post.url).hostname}
          </a>
        )}

        {post.body && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{post.body}</p>
        )}

        <Link href={`/post/${post.id}`}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <MessageSquare size={13} />
          {post.comment_count} comments
        </Link>
      </div>
    </div>
  )
}