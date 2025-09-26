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
    console.error('Canvas API token verification error:', err)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const isPublic = searchParams.get('public') === 'true'

    let query = supabaseServer
      .from('canvas')
      .select('*')
      .order('updated_at', { ascending: false })

    if (isPublic) {
      query = query.eq('is_public', true)
    } else {
      query = query.eq('user_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching canvas:', error)
      return NextResponse.json(
        { error: 'Failed to fetch canvas' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Canvas GET API error:', error)
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
    const { name, description, config, is_public = false } = body

    // Validate required fields
    if (!name || !config) {
      return NextResponse.json(
        { error: 'Name and config are required' },
        { status: 400 }
      )
    }

    // Create canvas
    const { data, error } = await supabaseServer
      .from('canvas')
      .insert([{
        user_id: user.id,
        name,
        description: description || null,
        config,
        is_public,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating canvas:', error)
      return NextResponse.json(
        { error: 'Failed to create canvas' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Canvas created successfully',
      canvas: data
    })

  } catch (error) {
    console.error('Canvas POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
