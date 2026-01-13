const MAX_EMAIL_LENGTH = 254;

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  if (!value) return false;
  if (value.length > MAX_EMAIL_LENGTH) return false;
  const simple = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return simple.test(value);
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'POST, OPTIONS',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'POST, OPTIONS',
        'Cache-Control': 'no-store',
      },
    });
  }

  if (!env?.WAITLIST_DB) {
    return json(
      { ok: false, code: 'not_configured' },
      {
        status: 501,
      }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, code: 'bad_json' }, { status: 400 });
  }

  const honeypot = typeof payload?.company === 'string' ? payload.company : '';
  if (honeypot && honeypot.trim()) {
    return json({ ok: true, already: true }, { status: 200 });
  }

  const email = normalizeEmail(payload?.email);
  if (!isValidEmail(email)) {
    return json({ ok: false, code: 'invalid_email' }, { status: 400 });
  }

  try {
    const createdAt = new Date().toISOString();
    const result = await env.WAITLIST_DB.prepare(
      'INSERT OR IGNORE INTO waitlist (email, created_at) VALUES (?, ?)'
    )
      .bind(email, createdAt)
      .run();

    const changes = result?.meta?.changes ?? 0;
    return json({ ok: true, already: changes === 0 }, { status: 200 });
  } catch {
    return json({ ok: false, code: 'server_error' }, { status: 500 });
  }
}

