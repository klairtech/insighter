import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, setCachedData, checkRateLimit, verifyUserSession } from '@/lib/server-utils'

// Type for organization membership data
// type MembershipData = {
//   organization_id: string;
//   role: string;
//   created_at: string;
// };


// Cache key for organizations
const CACHE_KEY = 'organizations'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = checkRateLimit(clientIP, 100, 15 * 60 * 1000) // 100 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900' // 15 minutes
          }
        }
      )
    }

    // Verify user session
    const authResult = await verifyUserSession(request)
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = authResult.user

    // First, get organization memberships
    const { data: memberData, error: memberError } = await supabaseServer
      .from('organization_members')
      .select('organization_id, role, created_at')
      .eq('user_id', user.id)

    if (memberError) {
      console.error('Error fetching organization memberships:', memberError)
      return NextResponse.json(
        { error: 'Failed to fetch organization memberships' },
        { status: 500 }
      )
    }

    if (!memberData || memberData.length === 0) {
      console.log('No organization memberships found for user')
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'private, max-age=60, s-maxage=60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      })
    }

    // Extract organization IDs
    const orgIds = memberData.map((member) => member.organization_id)

    // Fetch organizations with active workspaces
    const { data: organizations, error: orgError } = await supabaseServer
      .from('organizations')
      .select(`
        *,
        workspaces(
          id,
          name,
          description,
          created_at,
          updated_at,
          status
        )
      `)
      .in('id', orgIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (orgError) {
      console.error('Error fetching organizations:', orgError)
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    // Create a map of organization_id to role for quick lookup
    const roleMap = new Map(memberData.map(member => [member.organization_id, member.role]))

    // Transform the data to include user role and filter workspaces
    const organizationsWithRoles = (organizations || []).map((org) => ({
      ...org,
      userRole: roleMap.get(org.id) || 'member',
      workspaces: (org.workspaces || []).filter((workspace: { status: string }) => workspace.status === 'active')
    }))

    return NextResponse.json(organizationsWithRoles, {
      headers: {
        'Cache-Control': 'private, max-age=60, s-maxage=60',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    })
  } catch (error) {
    console.error('Error in organizations API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Organization creation request received')
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    // Verify user authentication
    const authResult = await verifyUserSession(request)
    console.log('Auth result:', authResult)
    
    if (!authResult) {
      console.error('Organization creation failed: User not authenticated')
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          details: 'User session not found or invalid'
        },
        { status: 401 }
      )
    }
    
    const user = authResult.user
    console.log('User object:', user)
    console.log('User ID:', user?.id)
    
    if (!user) {
      console.error('User object is null or undefined')
      return NextResponse.json(
        { 
          error: 'Authentication failed',
          details: 'User object is null or undefined'
        },
        { status: 401 }
      )
    }

    // Test database connection
    try {
      const { error: testError } = await supabaseServer
        .from('organizations')
        .select('count')
        .limit(1)
      
      if (testError) {
        console.error('Database connection test failed:', testError)
        return NextResponse.json(
          { 
            error: 'Database connection failed',
            details: testError.message,
            code: testError.code
          },
          { status: 500 }
        )
      }
      console.log('Database connection test successful')
    } catch (dbTestException) {
      console.error('Database connection test exception:', dbTestException)
      return NextResponse.json(
        { 
          error: 'Database connection test exception',
          details: dbTestException instanceof Error ? dbTestException.message : 'Unknown exception'
        },
        { status: 500 }
      )
    }

    // Ensure user exists in public.users table
    const { error: userError } = await supabaseServer
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (userError && userError.code === 'PGRST116') {
      // User doesn't exist in public.users table, create them
      console.log('Creating user record in public.users table:', user.id)
      try {
        const { error: createUserError } = await supabaseServer
          .from('users')
          .insert([{
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])

        if (createUserError) {
          console.error('Error creating user record:', createUserError)
          return NextResponse.json(
            { 
              error: 'Failed to create user record',
              details: createUserError.message,
              code: createUserError.code
            },
            { status: 500 }
          )
        }
        console.log('User record created successfully')
        
        // Allocate welcome credits for new user
        try {
          const welcomeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/credits/allocate-welcome`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              email: user.email
            })
          })
          
          if (welcomeResponse.ok) {
            console.log('Welcome credits allocated successfully')
          } else {
            console.error('Failed to allocate welcome credits')
          }
        } catch (welcomeError) {
          console.error('Error allocating welcome credits:', welcomeError)
        }
      } catch (createUserException) {
        console.error('Exception creating user record:', createUserException)
        return NextResponse.json(
          { 
            error: 'Exception creating user record',
            details: createUserException instanceof Error ? createUserException.message : 'Unknown exception'
          },
          { status: 500 }
        )
      }
    } else if (userError) {
      console.error('Error checking user record:', userError)
      return NextResponse.json(
        { 
          error: 'Failed to verify user record',
          details: userError.message,
          code: userError.code
        },
        { status: 500 }
      )
    }

    // Rate limiting for POST requests (more restrictive)
    const clientIP = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = checkRateLimit(clientIP + '-post', 20, 15 * 60 * 1000); // 20 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': '900'
          }
        }
      )
    }

    let body;
    try {
      body = await request.json()
      console.log('Request body:', body)
    } catch (jsonError) {
      console.error('Error parsing request JSON:', jsonError)
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          details: jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'
        },
        { status: 400 }
      )
    }
    
    // Validate required fields
    if (!body.name) {
      console.error('Organization creation failed: Missing name field')
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }


    // Create organization
    console.log('Creating organization with data:', {
      name: body.name,
      description: body.description,
      industry: body.industry,
      size: body.size,
      website: body.website,
      location: body.location
    })
    
    let organization, orgError;
    try {
      const result = await supabaseServer
        .from('organizations')
        .insert([{
          name: body.name,
          description: body.description,
          industry: body.industry,
          size: body.size,
          website: body.website,
          location: body.location,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()
      
      organization = result.data;
      orgError = result.error;
    } catch (orgException) {
      console.error('Exception creating organization:', orgException)
      return NextResponse.json(
        { 
          error: 'Exception creating organization',
          details: orgException instanceof Error ? orgException.message : 'Unknown exception'
        },
        { status: 500 }
      )
    }

    if (orgError) {
      console.error('Error creating organization:', orgError)
      return NextResponse.json(
        { 
          error: 'Failed to create organization',
          details: orgError.message,
          code: orgError.code
        },
        { status: 500 }
      )
    }

    // Add the creator as the owner/admin of the organization
    console.log('Creating organization membership for user:', user.id, 'organization:', organization.id)
    
    let membership, membershipError;
    try {
      const result = await supabaseServer
        .from('organization_members')
        .insert([{
          organization_id: organization.id,
          user_id: user.id,
          role: 'owner', // Creator becomes owner
          status: 'active',
          created_at: new Date().toISOString()
        }])
        .select()
        .single()
      
      membership = result.data;
      membershipError = result.error;
    } catch (membershipException) {
      console.error('Exception creating organization membership:', membershipException)
      // If membership creation fails, we should clean up the organization
      try {
        await supabaseServer
          .from('organizations')
          .delete()
          .eq('id', organization.id)
        console.log('Cleaned up organization after membership creation failure')
      } catch (cleanupError) {
        console.error('Error cleaning up organization:', cleanupError)
      }
      
      return NextResponse.json(
        { 
          error: 'Exception creating organization membership',
          details: membershipException instanceof Error ? membershipException.message : 'Unknown exception'
        },
        { status: 500 }
      )
    }

    if (membershipError) {
      console.error('Error creating organization membership:', membershipError)
      // If membership creation fails, we should clean up the organization
      await supabaseServer
        .from('organizations')
        .delete()
        .eq('id', organization.id)
      
      return NextResponse.json(
        { 
          error: 'Failed to create organization membership',
          details: membershipError.message,
          code: membershipError.code
        },
        { status: 500 }
      )
    }

    // Invalidate cache
    setCachedData(CACHE_KEY, null)

    console.log('Organization created successfully:', organization.id)
    
    return NextResponse.json({
      ...organization,
      membership: membership
    }, {
      status: 201,
      headers: {
        'Cache-Control': 'no-cache',
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetTime.toString(),
      }
    })
  } catch (error) {
    console.error('Error in organizations POST API:', error)
    
    // Ensure we return a properly serializable error response
    const errorResponse = {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
    
    console.log('Returning error response:', errorResponse)
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}