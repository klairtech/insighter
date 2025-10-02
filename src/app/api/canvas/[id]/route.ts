import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

// Helper function to verify user session
async function verifyUserSession(request: NextRequest) {
  if (!supabaseServer) {
    return null
  }

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { id } = await params

    // Get canvas (public canvases don't require auth)
    const { data: canvas, error } = await supabaseServer
      .from('canvas')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !canvas) {
      return NextResponse.json(
        { error: 'Canvas not found' },
        { status: 404 }
      )
    }

    // If canvas is not public, require authentication
    if (!canvas.is_public) {
      const user = await verifyUserSession(request)
      if (!user || canvas.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(canvas)

  } catch (error) {
    console.error('Canvas GET by ID API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, config, is_public } = body

    // Check if canvas exists and user owns it
    const { data: existingCanvas, error: fetchError } = await supabaseServer
      .from('canvas')
      .select('user_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingCanvas) {
      return NextResponse.json(
        { error: 'Canvas not found' },
        { status: 404 }
      )
    }

    if (existingCanvas.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Update canvas
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (config !== undefined) updateData.config = config
    if (is_public !== undefined) updateData.is_public = is_public

    const { data, error } = await supabaseServer
      .from('canvas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating canvas:', error)
      return NextResponse.json(
        { error: 'Failed to update canvas' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Canvas updated successfully',
      canvas: data
    })

  } catch (error) {
    console.error('Canvas PUT API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const user = await verifyUserSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Check if canvas exists and user owns it
    const { data: existingCanvas, error: fetchError } = await supabaseServer
      .from('canvas')
      .select('user_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingCanvas) {
      return NextResponse.json(
        { error: 'Canvas not found' },
        { status: 404 }
      )
    }

    if (existingCanvas.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Delete canvas
    const { error } = await supabaseServer
      .from('canvas')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting canvas:', error)
      return NextResponse.json(
        { error: 'Failed to delete canvas' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Canvas deleted successfully'
    })

  } catch (error) {
    console.error('Canvas DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
