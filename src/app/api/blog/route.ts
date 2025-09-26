import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

// Helper function to verify user session
async function verifyUserSession(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token)
    if (error || !user) {
      return null
    }
    return user
  } catch (err) {
    console.error('Blog API token verification error:', err)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const published = searchParams.get('published')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabaseServer
      .from('blog_posts')
      .select(`
        *,
        users!blog_posts_author_id_fkey (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (published !== null) {
      query = query.eq('published', published === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching blog posts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch blog posts' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Blog GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, content, excerpt, slug, published = false, tags = [] } = body

    // Validate required fields
    if (!title || !content || !slug) {
      return NextResponse.json(
        { error: 'Title, content, and slug are required' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const { data: existingPost } = await supabaseServer
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingPost) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 400 }
      )
    }

    // Create blog post
    const { data, error } = await supabaseServer
      .from('blog_posts')
      .insert([{
        title,
        content,
        excerpt: excerpt || null,
        slug,
        published,
        tags,
        author_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating blog post:', error)
      return NextResponse.json(
        { error: 'Failed to create blog post' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Blog post created successfully',
      post: data
    })

  } catch (error) {
    console.error('Blog POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
