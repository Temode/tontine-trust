import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Signature JWT HS256 pour LiveKit (pas de dépendance externe)
function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array ? input : new Uint8Array(input)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function signJwtHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encHeader = base64url(JSON.stringify(header))
  const encPayload = base64url(JSON.stringify(payload))
  const data = `${encHeader}.${encPayload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${base64url(sig)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('LIVEKIT_API_KEY')
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    const wsUrl = Deno.env.get('LIVEKIT_WS_URL')
    if (!apiKey || !apiSecret || !wsUrl) {
      return new Response(JSON.stringify({ error: 'LiveKit non configuré' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = claimsData.claims.sub as string

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const callId = typeof body.callId === 'string' ? body.callId : null
    const displayName = typeof body.displayName === 'string' && body.displayName.trim()
      ? body.displayName.trim().slice(0, 80)
      : 'Participant'
    if (!callId || !/^[0-9a-f-]{36}$/i.test(callId)) {
      return new Response(JSON.stringify({ error: 'callId invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Contexte d'appel : autorisation, rôle hôte, verrou de la salle
    const { data: ctxRows, error: rpcError } = await supabase.rpc('get_call_context', {
      p_call_id: callId,
    })
    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows
    if (!ctx?.allowed) {
      return new Response(JSON.stringify({ error: 'Accès refusé à cet appel' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const isHost = !!ctx.is_host
    if (ctx.locked && !isHost) {
      return new Response(JSON.stringify({ error: 'La salle est verrouillée par l\u2019hôte.' }), {
        status: 423,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const roomName = `call_${callId}`
    const now = Math.floor(Date.now() / 1000)
    const ttlSeconds = 60 * 60 * 4 // 4h

    const payload = {
      iss: apiKey,
      sub: userId,
      iat: now,
      nbf: now,
      exp: now + ttlSeconds,
      name: displayName,
      metadata: JSON.stringify({ role: isHost ? 'host' : 'participant' }),
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: isHost,
      },
    }

    const jwt = await signJwtHS256(payload, apiSecret)

    return new Response(
      JSON.stringify({ token: jwt, wsUrl, roomName, identity: userId, isHost }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})