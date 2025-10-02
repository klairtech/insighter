import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/server-utils'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseServer) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const days = parseInt(searchParams.get('days') || '30')
    const groupBy = searchParams.get('group_by') || 'model' // model, provider, user, date

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabaseServer
      .from('token_usage')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .not('model_used', 'is', null)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: usageData, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching model usage data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch model usage data' },
        { status: 500 }
      )
    }

    // Group data based on groupBy parameter
    let analytics
    switch (groupBy) {
      case 'model':
        analytics = groupByModel(usageData || [])
        break
      case 'provider':
        analytics = groupByProvider(usageData || [])
        break
      case 'user':
        analytics = groupByUser(usageData || [])
        break
      case 'date':
        analytics = groupByDate(usageData || [])
        break
      default:
        analytics = groupByModel(usageData || [])
    }

    return NextResponse.json({
      success: true,
      data: analytics,
      summary: {
        total_requests: usageData?.length || 0,
        total_tokens: usageData?.reduce((sum, item) => sum + item.tokens_used, 0) || 0,
        date_range: {
          start: startDate.toISOString(),
          end: new Date().toISOString()
        },
        group_by: groupBy
      }
    })

  } catch (error) {
    console.error('Model usage analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface ModelUsageItem {
  model_used: string;
  model_provider: string;
  model_version: string;
  created_at: string;
  user_id: string;
  input_tokens?: number;
  output_tokens?: number;
  tokens_used?: number;
  fallback_used?: boolean;
}

interface GroupedModelUsage {
  [key: string]: {
    model_used?: string;
    model_provider: string;
    model_version?: string;
    user_id?: string;
    date?: string;
    total_requests: number;
    total_tokens: number;
    total_input_tokens: number;
    total_output_tokens: number;
    fallback_requests: number;
    unique_models?: Set<string>;
    unique_providers?: Set<string>;
    unique_users: Set<string>;
    first_used: string;
    last_used: string;
  };
}

function groupByModel(data: ModelUsageItem[]) {
  const grouped = data.reduce((acc: GroupedModelUsage, item) => {
    const key = item.model_used
    if (!acc[key]) {
      acc[key] = {
        model_used: item.model_used,
        model_provider: item.model_provider,
        model_version: item.model_version,
        total_requests: 0,
        total_tokens: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        fallback_requests: 0,
        unique_users: new Set(),
        first_used: item.created_at,
        last_used: item.created_at
      }
    }
    
    acc[key].total_requests++
    acc[key].total_tokens += item.tokens_used || 0
    acc[key].total_input_tokens += item.input_tokens || 0
    acc[key].total_output_tokens += item.output_tokens || 0
    if (item.fallback_used) acc[key].fallback_requests++
    acc[key].unique_users.add(item.user_id)
    acc[key].first_used = new Date(Math.min(new Date(acc[key].first_used).getTime(), new Date(item.created_at).getTime())).toISOString()
    acc[key].last_used = new Date(Math.max(new Date(acc[key].last_used).getTime(), new Date(item.created_at).getTime())).toISOString()
    
    return acc
  }, {} as GroupedModelUsage)

  return Object.values(grouped).map((item) => ({
    ...item,
    unique_users: item.unique_users.size,
    avg_tokens_per_request: item.total_requests > 0 ? Math.round(item.total_tokens / item.total_requests) : 0,
    fallback_percentage: item.total_requests > 0 ? Math.round((item.fallback_requests / item.total_requests) * 100) : 0
  }))
}

function groupByProvider(data: ModelUsageItem[]) {
  const grouped = data.reduce((acc, item) => {
    const key = item.model_provider
    if (!acc[key]) {
      acc[key] = {
        model_provider: item.model_provider,
        total_requests: 0,
        total_tokens: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        fallback_requests: 0,
        unique_models: new Set(),
        unique_users: new Set(),
        first_used: item.created_at,
        last_used: item.created_at
      }
    }
    
    acc[key].total_requests++
    acc[key].total_tokens += item.tokens_used || 0
    acc[key].total_input_tokens += item.input_tokens || 0
    acc[key].total_output_tokens += item.output_tokens || 0
    if (item.fallback_used) acc[key].fallback_requests++
    acc[key].unique_models?.add(item.model_used)
    acc[key].unique_users.add(item.user_id)
    acc[key].first_used = new Date(Math.min(new Date(acc[key].first_used).getTime(), new Date(item.created_at).getTime())).toISOString()
    acc[key].last_used = new Date(Math.max(new Date(acc[key].last_used).getTime(), new Date(item.created_at).getTime())).toISOString()
    
    return acc
  }, {} as GroupedModelUsage)

  return Object.values(grouped).map((item) => ({
    ...item,
    unique_models: item.unique_models?.size || 0,
    unique_users: item.unique_users.size,
    avg_tokens_per_request: item.total_requests > 0 ? Math.round(item.total_tokens / item.total_requests) : 0,
    fallback_percentage: item.total_requests > 0 ? Math.round((item.fallback_requests / item.total_requests) * 100) : 0
  }))
}

function groupByUser(data: ModelUsageItem[]) {
  const grouped = data.reduce((acc, item) => {
    const key = item.user_id
    if (!acc[key]) {
      acc[key] = {
        user_id: item.user_id,
        model_provider: item.model_provider,
        total_requests: 0,
        total_tokens: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        fallback_requests: 0,
        unique_models: new Set(),
        unique_providers: new Set(),
        unique_users: new Set(),
        first_used: item.created_at,
        last_used: item.created_at
      }
    }
    
    acc[key].total_requests++
    acc[key].total_tokens += item.tokens_used || 0
    acc[key].total_input_tokens += item.input_tokens || 0
    acc[key].total_output_tokens += item.output_tokens || 0
    if (item.fallback_used) acc[key].fallback_requests++
    acc[key].unique_models?.add(item.model_used)
    acc[key].unique_providers?.add(item.model_provider)
    acc[key].first_used = new Date(Math.min(new Date(acc[key].first_used).getTime(), new Date(item.created_at).getTime())).toISOString()
    acc[key].last_used = new Date(Math.max(new Date(acc[key].last_used).getTime(), new Date(item.created_at).getTime())).toISOString()
    
    return acc
  }, {} as GroupedModelUsage)

  return Object.values(grouped).map((item) => ({
    ...item,
    unique_models: item.unique_models?.size || 0,
    unique_providers: item.unique_providers?.size || 0,
    avg_tokens_per_request: item.total_requests > 0 ? Math.round(item.total_tokens / item.total_requests) : 0,
    fallback_percentage: item.total_requests > 0 ? Math.round((item.fallback_requests / item.total_requests) * 100) : 0
  }))
}

function groupByDate(data: ModelUsageItem[]) {
  const grouped = data.reduce((acc, item) => {
    const date = new Date(item.created_at).toISOString().split('T')[0]
    if (!acc[date]) {
      acc[date] = {
        date: date,
        model_provider: item.model_provider,
        total_requests: 0,
        total_tokens: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        fallback_requests: 0,
        unique_models: new Set(),
        unique_providers: new Set(),
        unique_users: new Set(),
        first_used: item.created_at,
        last_used: item.created_at
      }
    }
    
    acc[date].total_requests++
    acc[date].total_tokens += item.tokens_used || 0
    acc[date].total_input_tokens += item.input_tokens || 0
    acc[date].total_output_tokens += item.output_tokens || 0
    if (item.fallback_used) acc[date].fallback_requests++
    acc[date].unique_models?.add(item.model_used)
    acc[date].unique_providers?.add(item.model_provider)
    acc[date].unique_users.add(item.user_id)
    
    return acc
  }, {} as GroupedModelUsage)

  return Object.values(grouped).map((item) => ({
    ...item,
    unique_models: item.unique_models?.size || 0,
    unique_providers: item.unique_providers?.size || 0,
    unique_users: item.unique_users.size,
    avg_tokens_per_request: item.total_requests > 0 ? Math.round(item.total_tokens / item.total_requests) : 0,
    fallback_percentage: item.total_requests > 0 ? Math.round((item.fallback_requests / item.total_requests) * 100) : 0
  })).sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
}
