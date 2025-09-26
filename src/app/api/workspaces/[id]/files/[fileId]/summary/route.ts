import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUserSession } from '@/lib/server-utils'
import { encryptText } from '@/lib/encryption'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    // Verify user session
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { fileId } = await params

    // Check file access
    const { data: file, error: fileError } = await supabaseServer
      .from('file_uploads')
      .select(`
        id,
        workspace_id,
        uploaded_by,
        workspaces (
          id,
          organization_id
        )
      `)
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Check if user has access to the workspace
    const { data: membership, error: membershipError } = await supabaseServer
      .from('organization_members')
      .select('role')
      .eq('user_id', session.userId)
      .eq('organization_id', file.workspaces[0]?.organization_id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Only file uploader or workspace owners can update
    if (file.uploaded_by !== session.userId && membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only file uploader or workspace owners can update file details' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { summary, key_points } = body
    
    console.log('📝 File summary update request:', {
      fileId,
      summary: summary ? `${summary.substring(0, 100)}...` : null,
      key_points: key_points?.length || 0
    })

    // Validate input
    if (summary && (typeof summary !== 'string' || summary.trim().length === 0)) {
      return NextResponse.json(
        { error: 'summary must be a non-empty string' },
        { status: 400 }
      )
    }

    if (key_points && (!Array.isArray(key_points) || !key_points.every(point => typeof point === 'string'))) {
      return NextResponse.json(
        { error: 'key_points must be an array of strings' },
        { status: 400 }
      )
    }

    // Prepare update object with encrypted fields
    const updateData: {
      summary?: string;
      key_points?: string[];
      summary_encrypted?: string;
      key_points_encrypted?: string;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString()
    }

    if (summary) {
      const trimmedSummary = summary.trim()
      updateData.summary = trimmedSummary // Keep for backward compatibility
      updateData.summary_encrypted = encryptText(trimmedSummary)
    }

    if (key_points) {
      const filteredKeyPoints = key_points.filter((point: string) => point.trim() !== '')
      updateData.key_points = filteredKeyPoints // Keep for backward compatibility
      updateData.key_points_encrypted = encryptText(JSON.stringify(filteredKeyPoints))
    }

    console.log('📝 Update data prepared:', {
      hasSummary: !!updateData.summary,
      hasSummaryEncrypted: !!updateData.summary_encrypted,
      hasKeyPoints: !!updateData.key_points,
      hasKeyPointsEncrypted: !!updateData.key_points_encrypted,
      updatedAt: updateData.updated_at
    })

    // Check if summary record exists
    const { error: checkError } = await supabaseServer
      .from('file_summaries')
      .select('id')
      .eq('file_id', fileId)
      .single()

    let updatedSummary
    let updateError

    if (checkError && checkError.code === 'PGRST116') {
      // No summary record exists, create one
      console.log('📝 Creating new file summary record')
      const { data, error } = await supabaseServer
        .from('file_summaries')
        .insert([{
          file_id: fileId,
          ...updateData
        }])
        .select()
        .single()
      
      updatedSummary = data
      updateError = error
    } else if (checkError) {
      console.error('Error checking existing summary:', checkError)
      return NextResponse.json(
        { error: 'Failed to check file summary' },
        { status: 500 }
      )
    } else {
      // Summary record exists, update it
      console.log('📝 Updating existing file summary record')
      const { data, error } = await supabaseServer
        .from('file_summaries')
        .update(updateData)
        .eq('file_id', fileId)
        .select()
        .single()
      
      updatedSummary = data
      updateError = error
    }

    if (updateError) {
      console.error('Error updating file summary:', updateError)
      return NextResponse.json(
        { error: 'Failed to update file summary' },
        { status: 500 }
      )
    }

    console.log('✅ File summary updated successfully:', updatedSummary?.id)

    return NextResponse.json(updatedSummary, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
      }
    })
  } catch (error) {
    console.error('Error in file summary PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
