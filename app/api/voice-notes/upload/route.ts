import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Use service role key — this runs server-side only
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await supabase.storage
      .from('voice-notes')
      .upload(path, buffer, { contentType: file.type })

    if (error) {
      console.error('Voice note storage upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data } = supabase.storage.from('voice-notes').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, path })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Voice note upload route error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
