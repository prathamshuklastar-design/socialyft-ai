export const maxDuration = 60

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()

    if (!query) {
      return NextResponse.json({ error: 'No query' }, { status: 400 })
    }

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are Socialyft AI — India's most powerful marketing intelligence engine.
You help Indian creators and brands discover trends, analyse competitors, and generate content strategies.
Always give practical, India-specific, actionable insights.
Never mention Claude, Anthropic, or any AI company.
Format your response clearly with sections.`,
      messages: [{ role: 'user', content: query }]
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error: any) {
    console.error('Status:', error?.status)
    console.error('Message:', error?.message)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}