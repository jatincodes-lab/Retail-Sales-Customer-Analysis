export function nextIdempotencyKey(ref) {
  if (!ref.current) ref.current = window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return ref.current;
}
