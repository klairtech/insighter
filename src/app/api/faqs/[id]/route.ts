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
    // For now, we'll allow any authenticated user to manage FAQs
    return user
  } catch (err) {
    console.error('FAQ API token verification error:', err)
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

    // Get FAQ by ID
    const { data: faq, error } = await supabaseServer!
      .from('faqs')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(faq)

  } catch (error) {
    console.error('FAQ GET by ID API error:', error)
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

    const user = await verifyAdminSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { question, answer, category, display_order, published } = body

    // Check if FAQ exists
    const { data: existingFaq, error: fetchError } = await supabaseServer
      .from('faqs')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existingFaq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      )
    }

    // Update FAQ
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (question !== undefined) updateData.question = question
    if (answer !== undefined) updateData.answer = answer
    if (category !== undefined) updateData.category = category
    if (display_order !== undefined) updateData.display_order = display_order
    if (published !== undefined) updateData.published = published

    const { data, error } = await supabaseServer
      .from('faqs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating FAQ:', error)
      return NextResponse.json(
        { error: 'Failed to update FAQ' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'FAQ updated successfully',
      faq: data
    })

  } catch (error) {
    console.error('FAQ PUT API error:', error)
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

    const user = await verifyAdminSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Check if FAQ exists
    const { data: existingFaq, error: fetchError } = await supabaseServer
      .from('faqs')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existingFaq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      )
    }

    // Delete FAQ
    const { error } = await supabaseServer
      .from('faqs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting FAQ:', error)
      return NextResponse.json(
        { error: 'Failed to delete FAQ' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'FAQ deleted successfully'
    })

  } catch (error) {
    console.error('FAQ DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
