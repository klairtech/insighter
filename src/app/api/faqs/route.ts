import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

// Helper function to verify admin session
async function verifyAdminSession(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const published = searchParams.get('published')

    let query = supabaseServer
      .from('faqs')
      .select('*')
      .order('display_order', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    if (published !== null) {
      query = query.eq('published', published === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching FAQs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch FAQs' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('FAQ GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdminSession(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { question, answer, category, display_order = 0, published = false } = body

    // Validate required fields
    if (!question || !answer || !category) {
      return NextResponse.json(
        { error: 'Question, answer, and category are required' },
        { status: 400 }
      )
    }

    // Create FAQ
    const { data, error } = await supabaseServer
      .from('faqs')
      .insert([{
        question,
        answer,
        category,
        display_order,
        published,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating FAQ:', error)
      return NextResponse.json(
        { error: 'Failed to create FAQ' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'FAQ created successfully',
      faq: data
    })

  } catch (error) {
    console.error('FAQ POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
