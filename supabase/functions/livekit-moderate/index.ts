import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array ? input : new Uint8Array(input)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function signAdminJwt(apiKey: string, apiSecret: string, roomName: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: apiKey,
    sub: `admin-${apiKey}`,
    iat: now,
    nbf: now,
    exp: now + 60,
    video: { room: roomName, roomAdmin: true, roomCreate: false },
  }
  const header = { alg: 'HS256', typ: 'JWT' }
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${base64url(sig)}`
}

function httpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:')
}

async function callLiveKitAdmin(
  wsUrl: string,
  path: string,
  adminToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`${httpUrl(wsUrl)}/twirp/livekit.RoomService/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
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

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const callId = typeof body.callId === 'string' ? body.callId : null
    const action = typeof body.action === 'string' ? body.action : null
    const targetIdentity = typeof body.targetIdentity === 'string' ? body.targetIdentity : null
    const trackSid = typeof body.trackSid === 'string' ? body.trackSid : null
    const locked = typeof body.locked === 'boolean' ? body.locked : null

    if (!callId || !/^[0-9a-f-]{36}$/i.test(callId) || !action) {
      return new Response(JSON.stringify({ error: 'Requête invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Autorisation modérateur
    const { data: canMod, error: modErr } = await supabase.rpc('can_moderate_call', {
      p_call_id: callId,
    })
    if (modErr) {
      return new Response(JSON.stringify({ error: modErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!canMod) {
      return new Response(JSON.stringify({ error: 'Non autorisé à modérer cet appel' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const roomName = `call_${callId}`
    const adminToken = await signAdminJwt(apiKey, apiSecret, roomName)

    let result: { ok: boolean; status: number; text: string } | null = null

    if (action === 'lock' || action === 'unlock') {
      const target = action === 'lock'
      const { error: lockErr } = await supabase.rpc('set_call_lock', {
        p_call_id: callId,
        p_locked: target,
      })
      if (lockErr) {
        return new Response(JSON.stringify({ error: lockErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // Diffuse l'état dans la métadonnée de la salle pour les clients
      result = await callLiveKitAdmin(wsUrl, 'UpdateRoomMetadata', adminToken, {
        room: roomName,
        metadata: JSON.stringify({ locked: target }),
      })
    } else if (action === 'kick') {
      if (!targetIdentity) {
        return new Response(JSON.stringify({ error: 'targetIdentity requis' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      result = await callLiveKitAdmin(wsUrl, 'RemoveParticipant', adminToken, {
        room: roomName,
        identity: targetIdentity,
      })
    } else if (action === 'mute') {
      if (!targetIdentity || !trackSid) {
        return new Response(JSON.stringify({ error: 'targetIdentity et trackSid requis' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      result = await callLiveKitAdmin(wsUrl, 'MutePublishedTrack', adminToken, {
        room: roomName,
        identity: targetIdentity,
        track_sid: trackSid,
        muted: true,
      })
    } else {
      return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!result?.ok) {
      return new Response(
        JSON.stringify({ error: `LiveKit ${result?.status}: ${result?.text}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ ok: true, action, locked }),
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