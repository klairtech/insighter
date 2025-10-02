import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create server-side Supabase client with service role key for admin operations
export const supabaseServer = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null

// Create server-side Supabase client that can read session cookies
export async function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is missing')
  }
  
  const cookieStore = await cookies()
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        // Check if we're in a server context where cookies can be set
        try {
          // This will only work in server actions, route handlers, or server components
          cookieStore.set({ name, value, ...options })
        } catch {
          // Silently ignore cookie setting errors - this is expected in client components
          // Don't log warnings as this is normal behavior
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        // Check if we're in a server context where cookies can be removed
        try {
          // This will only work in server actions, route handlers, or server components
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // Silently ignore cookie removal errors - this is expected in client components
          // Don't log warnings as this is normal behavior
        }
      },
    },
  })
}

// Also export as supabaseAdmin for compatibility
export const supabaseAdmin = supabaseServer

// Create client-side Supabase client (read-only for cookies)
export function createClientSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  })
}

// Create a client-side Supabase client that doesn't try to set cookies
// This should be used in client components to avoid cookie setting errors
export function createClientOnlySupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      // Don't try to set cookies in client components
      flowType: 'pkce'
    }
  })
}

// Helper function to verify user session from request headers
export async function verifyUserSession(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ verifyUserSession - No valid auth header')
    return null
  }

  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token)
    if (error || !user) {
      console.log('❌ verifyUserSession - Error or no user:', error?.message || 'No user')
      return null
    }
    return { userId: user.id, user }
  } catch (err) {
    console.error('❌ verifyUserSession - Exception:', err)
    return null
  }
}

// Server-side data fetching utilities
export async function getServerSideOrganizations() {
  try {
    const { data, error } = await supabaseServer
      .from('organizations')
      .select(`
        *,
        workspaces (
          id,
          name,
          description,
          created_at,
          updated_at
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching organizations:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getServerSideOrganizations:', error)
    return []
  }
}

export async function getServerSideUser(userId: string) {
  try {
    const { data, error } = await supabaseServer
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getServerSideUser:', error)
    return null
  }
}

// Cache utilities for server-side rendering
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T
  }
  return null
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// Server-side metadata generation
export function generatePageMetadata({
  title,
  description,
  keywords = [],
  image = '/og-image.jpg'
}: {
  title: string
  description: string
  keywords?: string[]
  image?: string
}) {
  return {
    title: `${title} | Insighter`,
    description,
    keywords: ['Insighter', 'AI', 'Data Analytics', ...keywords].join(', '),
    openGraph: {
      title: `${title} | Insighter`,
      description,
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Insighter`,
      description,
      images: [image],
    },
  }
}

// Server-side validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Server-side rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier
  const current = rateLimitMap.get(key)

  if (!current || now > current.resetTime) {
    // Reset or create new entry
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: now + windowMs
    }
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime
    }
  }

  current.count++
  return {
    allowed: true,
    remaining: limit - current.count,
    resetTime: current.resetTime
  }
}
