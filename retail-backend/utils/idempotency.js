const { createHash } = require('node:crypto');
let lastCleanupAt = 0;

function requestHash(body) {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}

async function claimIdempotency(client, userId, routeKey, key, body) {
  if (key == null) throw Object.assign(new Error('Idempotency-Key header is required'), { status: 400 });
  if (typeof key !== 'string' || key.length < 8 || key.length > 128)
    throw Object.assign(new Error('Idempotency-Key must be 8 to 128 characters'), { status: 400 });
  const hash = requestHash(body);
  if (Date.now() - lastCleanupAt > 60 * 60 * 1000) {
    await client.query("DELETE FROM request_idempotency WHERE created_at < now()-INTERVAL '90 days'");
    lastCleanupAt = Date.now();
  }
  const inserted = await client.query(`
    INSERT INTO request_idempotency(user_id,route_key,idempotency_key,request_hash)
    VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING idempotency_key`,
  [userId, routeKey, key, hash]);
  if (inserted.rowCount) return { key, hash, replay: false };
  const { rows } = await client.query(`
    SELECT request_hash,response_status,response_body FROM request_idempotency
    WHERE user_id=$1 AND route_key=$2 AND idempotency_key=$3 FOR UPDATE`,
  [userId, routeKey, key]);
  if (!rows.length) throw new Error('Could not read idempotency record');
  if (rows[0].request_hash !== hash)
    throw Object.assign(new Error('Idempotency-Key was already used for a different request'), { status: 409 });
  if (rows[0].response_status == null)
    throw Object.assign(new Error('A request with this Idempotency-Key is already in progress'), { status: 409 });
  return { replay: true, status: rows[0].response_status, body: rows[0].response_body };
}

async function saveIdempotentResponse(client, userId, routeKey, claim, status, body) {
  if (!claim || claim.replay) return;
  await client.query(`
    UPDATE request_idempotency SET response_status=$1,response_body=$2::jsonb
    WHERE user_id=$3 AND route_key=$4 AND idempotency_key=$5 AND request_hash=$6`,
  [status, JSON.stringify(body), userId, routeKey, claim.key, claim.hash]);
}

module.exports = { claimIdempotency, saveIdempotentResponse };
