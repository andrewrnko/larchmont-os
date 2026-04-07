import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    // Graceful degradation — transcription is optional
    return NextResponse.json({ transcript: null, skipped: true })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Forward to Groq Whisper
    const groqForm = new FormData()
    groqForm.append('file', file, file.name)
    groqForm.append('model', 'whisper-large-v3-turbo')
    groqForm.append('response_format', 'json')
    groqForm.append('language', 'en')

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      console.error('Groq transcription error:', err)
      return NextResponse.json({ transcript: null, error: 'Transcription failed' })
    }

    const result = await groqRes.json() as { text: string }
    return NextResponse.json({ transcript: result.text ?? null })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Transcribe route error:', msg)
    return NextResponse.json({ transcript: null, error: msg })
  }
}
