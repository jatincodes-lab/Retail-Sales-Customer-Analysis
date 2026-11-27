const test = require('node:test');
const assert = require('node:assert/strict');
const sendError = require('../utils/errors');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('database constraint errors map to client responses without leaking SQL details', () => {
  const duplicate = response();
  sendError(duplicate, { code: '23505', message: 'private constraint detail' });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.body.error.includes('private'), false);

  const invalid = response();
  sendError(invalid, { code: '23514', message: 'private check detail' });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.error.includes('private'), false);

  const missing = response();
  sendError(missing, { status: 404, message: 'Product not found' });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.body.error, 'Product not found');
});
