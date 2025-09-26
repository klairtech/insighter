import { NextRequest, NextResponse } from 'next/server'
import { verifyUserSession } from '@/lib/server-utils'
import OpenAI from 'openai'

/**
 * API endpoint to test OpenAI connection and configuration
 * This helps diagnose AI generation issues
 */
export async function GET(request: NextRequest) {
  try {
    const session = await verifyUserSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured',
        details: 'OPENAI_API_KEY environment variable is missing'
      }, { status: 500 })
    }

    // Test OpenAI connection with a simple request
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Say "OpenAI connection test successful" and nothing else.' }
        ],
        max_tokens: 10,
        temperature: 0
      })

      const content = response.choices[0]?.message?.content
      
      return NextResponse.json({
        success: true,
        message: 'OpenAI connection test successful',
        response: content,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        tokens_used: response.usage?.total_tokens || 0
      })

    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError)
      return NextResponse.json({
        success: false,
        error: 'OpenAI API request failed',
        details: openaiError instanceof Error ? openaiError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Test OpenAI API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
