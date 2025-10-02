/**
 * Model Configuration API
 * 
 * Provides endpoints for managing AI model configurations and cost tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { modelConfigManager } from '@/lib/model-config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'embedding' | 'chat' | 'completion' | 'image' | null
    const activeOnly = searchParams.get('active_only') === 'true'

    let models
    if (type) {
      models = modelConfigManager.getModelsByType(type)
    } else if (activeOnly) {
      models = modelConfigManager.getActiveModels()
    } else {
      models = modelConfigManager.getAllModels()
    }

    return NextResponse.json({
      success: true,
      models,
      count: models.length
    })

  } catch (error) {
    console.error('Model config API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get model configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, modelId, updates } = body

    switch (action) {
      case 'update_model':
        if (!modelId || !updates) {
          return NextResponse.json(
            { error: 'Missing modelId or updates' },
            { status: 400 }
          )
        }
        
        const success = modelConfigManager.updateModel(modelId, updates)
        if (!success) {
          return NextResponse.json(
            { error: 'Model not found' },
            { status: 404 }
          )
        }
        
        return NextResponse.json({
          success: true,
          message: 'Model updated successfully'
        })

      case 'set_active':
        if (!modelId) {
          return NextResponse.json(
            { error: 'Missing modelId' },
            { status: 400 }
          )
        }
        
        const isActive = body.isActive !== false
        const activeSuccess = modelConfigManager.setModelActive(modelId, isActive)
        if (!activeSuccess) {
          return NextResponse.json(
            { error: 'Model not found' },
            { status: 404 }
          )
        }
        
        return NextResponse.json({
          success: true,
          message: `Model ${isActive ? 'activated' : 'deactivated'} successfully`
        })

      case 'update_cost_limits':
        const { costLimits } = body
        if (!costLimits) {
          return NextResponse.json(
            { error: 'Missing costLimits' },
            { status: 400 }
          )
        }
        
        modelConfigManager.updateCostLimits(costLimits)
        return NextResponse.json({
          success: true,
          message: 'Cost limits updated successfully'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Model config API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update model configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
