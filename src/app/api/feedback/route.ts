import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

// Helper function to verify user session (optional for feedback)
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
    console.error('Feedback API token verification error:', err)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type,
      rating,
      title,
      description,
      user_email,
      user_name,
      company,
      website,
      phone,
      priority = 'medium',
      category,
      steps_to_reproduce,
      expected_behavior,
      actual_behavior,
      browser_info,
      device_info,
      url
    } = body

    // Validate required fields
    if (!type || !title || !description || !user_email || !user_name || !category) {
      return NextResponse.json(
        { error: 'Type, title, description, email, name, and category are required' },
        { status: 400 }
      )
    }

    // Validate type
    const validTypes = ['general', 'bug', 'feature', 'ui', 'performance', 'other']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical']
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority level' },
        { status: 400 }
      )
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Try to get user ID if authenticated
    const user = await verifyUserSession(request)
    const userId = user?.id || null

    // Create feedback
    const { data, error } = await supabaseServer!
      .from('feedback')
      .insert([{
        type,
        rating: rating || null,
        title,
        description,
        user_email,
        user_name,
        company: company || null,
        website: website || null,
        phone: phone || null,
        priority,
        category,
        steps_to_reproduce: steps_to_reproduce || null,
        expected_behavior: expected_behavior || null,
        actual_behavior: actual_behavior || null,
        browser_info: browser_info || userAgent,
        device_info: device_info || null,
        user_id: userId,
        session_id: null, // Could be generated if needed
        submitted_at: new Date().toISOString(),
        url: url || null,
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating feedback:', error)
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback_id: data.id
    })

  } catch (error) {
    console.error('Feedback POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // This endpoint is for admin use only - would need proper admin auth
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabaseServer!
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching feedback:', error)
      return NextResponse.json(
        { error: 'Failed to fetch feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Feedback GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
