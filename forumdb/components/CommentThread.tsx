'use client'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, ChevronUp as Up } from 'lucide-react'
import VoteButtons from './VoteButtons'
import type { Comment } from '@/lib/types'

interface Props {
  comments: Comment[]
  userId:   string | null
  postId:   string
  depth?:   number
}

export default function CommentThread({ comments, userId, postId, depth = 0 }: Props) {
  return (
    <div className={depth > 0 ? 'border-l-2 border-gray-100 pl-3 mt-2' : 'space-y-3'}>
      {comments.map(c => (
        <CommentNode key={c.id} comment={c} userId={userId} postId={postId} depth={depth} />
      ))}
    </div>
  )
}

function CommentNode({ comment, userId, postId, depth }: {
  comment: Comment; userId: string | null; postId: string; depth: number
}) {
  const [collapsed, setCollapsed] = useState(false)
  const age = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })

  return (
    <div className="text-sm">
      <div className="flex items-start gap-2">
        <VoteButtons
          targetId={comment.id}
          type="comment"
          score={comment.score}
          userVote={comment.user_vote ?? null}
          userId={userId}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <span className="font-semibold text-gray-700">
              u/{comment.author?.username}
            </span>
            <span>•</span>
            <span>{age}</span>
            {(comment.replies?.length ?? 0) > 0 && (
              <button onClick={() => setCollapsed(v => !v)}
                className="ml-1 hover:text-orange-500 flex items-center gap-0.5">
                {collapsed ? <ChevronDown size={13} /> : <Up size={13} />}
                {collapsed ? 'expand' : 'collapse'}
              </button>
            )}
          </div>
          {!collapsed && (
            <>
              <p className="text-gray-800 leading-relaxed">{comment.body}</p>
              {comment.replies && comment.replies.length > 0 && (
                <CommentThread
                  comments={comment.replies}
                  userId={userId}
                  postId={postId}
                  depth={depth + 1}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}