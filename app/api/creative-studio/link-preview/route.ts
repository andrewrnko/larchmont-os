// Fetches Open Graph metadata from a URL for link card previews.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json() as { url: string }
    if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LarchmontOS/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    const html = await res.text()

    const og = (name: string) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']og:${name}["'][^>]*content=["']([^"']*)["']`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${name}["']`, 'i'))
      return m?.[1] ?? ''
    }

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)

    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i)
    let favicon = faviconMatch?.[1] ?? ''
    if (favicon && !favicon.startsWith('http')) {
      const u = new URL(url)
      favicon = favicon.startsWith('/') ? `${u.origin}${favicon}` : `${u.origin}/${favicon}`
    }
    if (!favicon) {
      favicon = `${new URL(url).origin}/favicon.ico`
    }

    return NextResponse.json({
      title: og('title') || titleMatch?.[1]?.trim() || new URL(url).hostname,
      description: og('description') || descMatch?.[1] || '',
      image: og('image') || '',
      favicon,
    })
  } catch {
    return NextResponse.json({ title: '', description: '', image: '', favicon: '' })
  }
}
