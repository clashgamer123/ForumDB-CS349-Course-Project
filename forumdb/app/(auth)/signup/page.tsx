'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function SignupPage() {
  const [username, setUsername] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  const handleSignup = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/')
  }

  return (
    <div className="max-w-sm mx-auto mt-16 bg-white border border-gray-200
      rounded-md p-8 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <input placeholder="Username" value={username}
        onChange={e => setUsername(e.target.value)}
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm
          focus:outline-none focus:border-orange-400" />
      <input type="email" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm
          focus:outline-none focus:border-orange-400" />
      <input type="password" placeholder="Password (min 6 chars)" value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm
          focus:outline-none focus:border-orange-400" />
      <button onClick={handleSignup} disabled={loading}
        className="w-full bg-orange-500 text-white py-2 rounded-full font-semibold
          hover:bg-orange-600 disabled:opacity-50">
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>
      <p className="text-sm text-center text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-orange-500 hover:underline">Log in</Link>
      </p>
    </div>
  )
}