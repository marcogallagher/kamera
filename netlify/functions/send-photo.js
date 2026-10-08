const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  if (!TOKEN || !CHAT_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: 'env not set', has_token: !!TOKEN, has_chat: !!CHAT_ID }) };
  }

  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'multipart required', got: contentType }) };
    }

    const bodyBuf = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'binary');

    const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const ua = event.headers['user-agent'] || 'unknown';

    const parsed = parseMultipart(bodyBuf, contentType);
    if (!parsed || !parsed.photo) {
      return { statusCode: 400, body: JSON.stringify({ error: 'no photo field', keys: parsed ? Object.keys(parsed) : null }) };
    }

    const boundary2 = '----TgBoundary' + Date.now();
    const parts = [];
    const label = parsed.label || 'photo';
    const caption = `📸 Foto baru\nLabel: ${label}\nSize: ${parsed.photo.length} bytes\nIP: ${ip}\nUA: ${ua.slice(0,120)}`;

    parts.push(Buffer.from(
      `--${boundary2}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n`
    ));
    parts.push(Buffer.from(
      `--${boundary2}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`
    ));
    parts.push(Buffer.from(
      `--${boundary2}\r\nContent-Disposition: form-data; name="photo"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    ));
    parts.push(parsed.photo);
    parts.push(Buffer.from(`\r\n--${boundary2}--\r\n`));

    const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary2}` },
      body: Buffer.concat(parts)
    });

    const tgJson = await tgRes.json();
    if (!tgJson.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: 'telegram failed', status: tgRes.status, response: tgJson }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, label, size: parsed.photo.length })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};

function parseMultipart(buf, contentType) {
  const m = /boundary=(.+)$/.exec(contentType);
  if (!m) return null;
  const boundary = '--' + m[1].replace(/^"|"$/g, '');
  const boundaryBuf = Buffer.from(boundary);
  const result = {};
  let idx = 0;

  while (true) {
    const start = buf.indexOf(boundaryBuf, idx);
    if (start === -1) break;
    const afterStart = start + boundaryBuf.length;
    if (buf.slice(afterStart, afterStart + 2).toString() === '--') break;
    const headerEnd = buf.indexOf('\r\n\r\n', afterStart);
    if (headerEnd === -1) break;
    const headers = buf.slice(afterStart, headerEnd).toString();
    const nextBoundary = buf.indexOf(boundaryBuf, headerEnd);
    if (nextBoundary === -1) break;
    const data = buf.slice(headerEnd + 4, nextBoundary - 2);
    const nameMatch = /name="([^"]+)"/.exec(headers);
    if (nameMatch) {
      const name = nameMatch[1];
      if (headers.toLowerCase().includes('filename=')) {
        result[name] = data;
      } else {
        result[name] = data.toString();
      }
    }
    idx = nextBoundary;
  }
  return result;
              }
