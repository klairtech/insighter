import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, company, phone, service, message, form_type = 'contact' } = body

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    // Get client IP for tracking
    const clientIP = request.headers.get('x-real-ip') || 
                    request.headers.get('x-forwarded-for') || 
                    'unknown'

    // Insert contact form submission
    const { data, error } = await supabaseServer
      .from('contact_forms')
      .insert([{
        name,
        email,
        company: company || null,
        phone: phone || null,
        service: service || null,
        message,
        ip_address: clientIP,
        form_type,
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating contact form:', error)
      return NextResponse.json(
        { error: 'Failed to submit contact form' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contact form submitted successfully',
      id: data.id
    })

  } catch (error) {
    console.error('Contact form API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // This endpoint is for admin use only - would need proper auth
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseServer
      .from('contact_forms')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching contact forms:', error)
      return NextResponse.json(
        { error: 'Failed to fetch contact forms' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Contact forms GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
