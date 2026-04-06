'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Search, LogIn, LogOut, PlusCircle } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser]     = useState<User | null>(null)
  const [query, setQuery]   = useState('')
  const supabase            = createClient()
  const router              = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-4">
        <Link href="/" className="font-bold text-orange-500 text-lg tracking-tight shrink-0">
          ForumDB
        </Link>

        <form onSubmit={handleSearch} className="flex-1 flex items-center bg-gray-100
          rounded-full px-3 py-1 gap-2 max-w-xl">
          <Search size={15} className="text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search posts..."
            className="bg-transparent text-sm outline-none w-full"
          />
        </form>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <Link href="/submit" className="flex items-center gap-1 text-sm
                text-gray-600 hover:text-orange-500">
                <PlusCircle size={16} /> Post
              </Link>
              <button onClick={handleSignOut} className="flex items-center gap-1
                text-sm text-gray-600 hover:text-red-500">
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="flex items-center gap-1 text-sm
              bg-orange-500 text-white px-3 py-1 rounded-full hover:bg-orange-600">
              <LogIn size={14} /> Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}