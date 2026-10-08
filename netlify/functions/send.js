const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID   = process.env.CHAT_ID;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, description: 'Method Not Allowed' });
  }

  try {
    const { caption, photoBase64 } = JSON.parse(event.body);
    if (!photoBase64) return json(400, { ok: false, description: 'no photo' });

    const boundary = '----' + Math.random().toString(36).slice(2);
    const photoBuf = Buffer.from(photoBase64, 'base64');

    const parts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      photoBuf,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];

    const body = Buffer.concat(parts);

    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body
    });
    const data = await r.json();
    return json(200, data);
  } catch (err) {
    return json(500, { ok: false, description: err.message });
  }
};

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  };
      }
