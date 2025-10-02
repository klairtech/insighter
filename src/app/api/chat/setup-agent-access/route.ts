import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUserSession } from '@/lib/server-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Verify user session
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Grant access to all agents in workspaces where user is a member
    const { data: result, error } = await supabaseServer
      .rpc('grant_workspace_agent_access', { user_id: session.userId })

    if (error) {
      console.error('Error setting up agent access:', error)
      return NextResponse.json(
        { error: 'Failed to setup agent access' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Agent access setup completed successfully',
      result
    })
  } catch (error) {
    console.error('Error in setup agent access API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
