import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

// Helper function to verify admin session
async function verifyAdminSession(request: NextRequest) {
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
    
    // Check if user is admin (you might want to add an admin role check here)
    // For now, we'll allow any authenticated user to manage feedback
    return user
  } catch (err) {
    console.error('Feedback API token verification error:', err)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get feedback by ID
    const { data: feedback, error } = await supabaseServer!
      .from('feedback')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(feedback)

  } catch (error) {
    console.error('Feedback GET by ID API error:', error)
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
    const user = await verifyAdminSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status, notes, priority } = body

    // Check if feedback exists
    const { data: existingFeedback, error: fetchError } = await supabaseServer!
      .from('feedback')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      )
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['new', 'in_review', 'in_progress', 'resolved', 'closed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        )
      }
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['low', 'medium', 'high', 'critical']
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: 'Invalid priority' },
          { status: 400 }
        )
      }
    }

    // Update feedback
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (priority !== undefined) updateData.priority = priority

    const { data, error } = await supabaseServer!
      .from('feedback')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating feedback:', error)
      return NextResponse.json(
        { error: 'Failed to update feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback updated successfully',
      feedback: data
    })

  } catch (error) {
    console.error('Feedback PUT API error:', error)
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
    const user = await verifyAdminSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Check if feedback exists
    const { data: existingFeedback, error: fetchError } = await supabaseServer!
      .from('feedback')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      )
    }

    // Delete feedback
    const { error } = await supabaseServer!
      .from('feedback')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting feedback:', error)
      return NextResponse.json(
        { error: 'Failed to delete feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback deleted successfully'
    })

  } catch (error) {
    console.error('Feedback DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
