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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Get blog post by slug
    const { data: post, error } = await supabaseServer
      .from('blog_posts')
      .select(`
        *,
        users!blog_posts_author_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('slug', slug)
      .single()

    if (error || !post) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      )
    }

    // If post is not published, require authentication and author check
    if (!post.published) {
      const user = await verifyUserSession(request)
      if (!user || post.author_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(post)

  } catch (error) {
    console.error('Blog GET by slug API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { slug } = await params
    const body = await request.json()
    const { title, content, excerpt, new_slug, published, tags } = body

    // Check if post exists and user is the author
    const { data: existingPost, error: fetchError } = await supabaseServer
      .from('blog_posts')
      .select('author_id')
      .eq('slug', slug)
      .single()

    if (fetchError || !existingPost) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      )
    }

    if (existingPost.author_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // If changing slug, check if new slug exists
    if (new_slug && new_slug !== slug) {
      const { data: slugExists } = await supabaseServer
        .from('blog_posts')
        .select('id')
        .eq('slug', new_slug)
        .single()

      if (slugExists) {
        return NextResponse.json(
          { error: 'New slug already exists' },
          { status: 400 }
        )
      }
    }

    // Update blog post
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (new_slug !== undefined) updateData.slug = new_slug
    if (published !== undefined) updateData.published = published
    if (tags !== undefined) updateData.tags = tags

    const { data, error } = await supabaseServer
      .from('blog_posts')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      console.error('Error updating blog post:', error)
      return NextResponse.json(
        { error: 'Failed to update blog post' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Blog post updated successfully',
      post: data
    })

  } catch (error) {
    console.error('Blog PUT API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { slug } = await params

    // Check if post exists and user is the author
    const { data: existingPost, error: fetchError } = await supabaseServer
      .from('blog_posts')
      .select('author_id')
      .eq('slug', slug)
      .single()

    if (fetchError || !existingPost) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      )
    }

    if (existingPost.author_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Delete blog post
    const { error } = await supabaseServer
      .from('blog_posts')
      .delete()
      .eq('slug', slug)

    if (error) {
      console.error('Error deleting blog post:', error)
      return NextResponse.json(
        { error: 'Failed to delete blog post' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Blog post deleted successfully'
    })

  } catch (error) {
    console.error('Blog DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
