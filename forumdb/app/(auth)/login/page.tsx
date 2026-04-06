'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/')
  }

  return (
    <div className="max-w-sm mx-auto mt-16 bg-white border border-gray-200
      rounded-md p-8 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Log in to ForumDB</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <input type="email" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm
          focus:outline-none focus:border-orange-400" />
      <input type="password" placeholder="Password" value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm
          focus:outline-none focus:border-orange-400" />
      <button onClick={handleLogin} disabled={loading}
        className="w-full bg-orange-500 text-white py-2 rounded-full font-semibold
          hover:bg-orange-600 disabled:opacity-50">
        {loading ? 'Logging in...' : 'Log In'}
      </button>
      <p className="text-sm text-center text-gray-500">
        New here?{' '}
        <Link href="/signup" className="text-orange-500 hover:underline">Create account</Link>
      </p>
    </div>
  )
}