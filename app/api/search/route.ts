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

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are Socialyft AI — India's most powerful marketing intelligence engine.
You help Indian creators and brands discover trends, analyse competitors, and generate content strategies.
Always give practical, India-specific, actionable insights.
Never mention Claude, Anthropic, or any AI company.
Format your response clearly with sections.`,
      messages: [{ role: 'user', content: query }]
    })

    const result = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    return NextResponse.json({ result })

  } catch (error: any) {
  console.error('Status:', error?.status)
  console.error('Message:', error?.message)
  console.error('Error:', error?.error)
  return NextResponse.json({ error: 'Search failed' }, { status: 500 })
}
}