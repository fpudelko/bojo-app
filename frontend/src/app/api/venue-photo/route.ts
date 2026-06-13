import { NextRequest, NextResponse } from 'next/server'

// Proxy dla Google Places Photo API.
// Zdjęcia Google nie mogą być cachowane ani przechowywane — serwujemy je
// na żądanie przez ten endpoint, nie zapisujemy na własnym serwerze.
// Zgodnie z Google Maps Platform ToS.
//
// Użycie: <img src="/api/venue-photo?ref=<photo_reference>&w=800" />

const GOOGLE_PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo'

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')
  const w   = req.nextUrl.searchParams.get('w') ?? '800'

  if (!ref) {
    return NextResponse.json({ error: 'missing ref' }, { status: 400 })
  }

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const url = new URL(GOOGLE_PHOTO_URL)
  url.searchParams.set('maxwidth', w)
  url.searchParams.set('photo_reference', ref)
  url.searchParams.set('key', key)

  // Google responds with a redirect to the actual image
  const upstream = await fetch(url.toString(), { redirect: 'follow' })

  if (!upstream.ok) {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 })
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
  const body = await upstream.arrayBuffer()

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Cache 7 days in browser, 1 day at CDN edge — Google allows short-lived caching
      'Cache-Control': 'public, max-age=604800, s-maxage=86400',
    },
  })
}
