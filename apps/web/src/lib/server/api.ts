import "server-only";
import { countCall, MONTHLY_QUOTA, PER_MINUTE, verifyKey } from "./apikeys";
import { clientIp, problem } from "./http";
import { limitHeaders, rateLimit, type Limit } from "./ratelimit";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

/** Checks the IP limit, the API key, the per-key rate and the monthly quota. Returns a Response on failure. */
export async function authorize(req: Request): Promise<{ ok: true; headers: Record<string, string> } | { ok: false; res: Response }> {
  const ipLimit = await rateLimit(`ip:${clientIp(req)}`, 60, 60);
  if (!ipLimit.ok) return { ok: false, res: problem(429, "rate_limited", "Too many requests from this address.", { ...CORS, ...limitHeaders(ipLimit) }) };
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  let owner: Awaited<ReturnType<typeof verifyKey>> = null;
  try { owner = key ? await verifyKey(key) : null; } catch { return { ok: false, res: problem(503, "unavailable", "API keys are not available right now.", CORS) }; }
  if (!owner) return { ok: false, res: problem(401, "invalid_api_key", "Send a valid API key as 'Authorization: Bearer al_live_…'. Create one at /account.", CORS) };
  const rpm: Limit = await rateLimit(`key:${owner.id}`, PER_MINUTE, 60);
  if (!rpm.ok) return { ok: false, res: problem(429, "rate_limited", "Per-minute limit reached for this key.", { ...CORS, ...limitHeaders(rpm) }) };
  const calls = await countCall(owner.id);
  if (calls > MONTHLY_QUOTA) return { ok: false, res: problem(429, "quota_exceeded", `Fair-use limit of ${MONTHLY_QUOTA} calls this month reached. It resets on the 1st.`, CORS) };
  return { ok: true, headers: { ...CORS, ...limitHeaders(rpm), "X-Quota-Used": String(calls), "X-Quota-Limit": String(MONTHLY_QUOTA), "Cache-Control": "no-store" } };
}

/** Reads image files from a multipart body, enforcing size limits. */
export async function readImages(req: Request, names: string[], maxBytes: number): Promise<{ ok: true; files: Buffer[] } | { ok: false; res: Response }> {
  if (!(req.headers.get("content-type") ?? "").startsWith("multipart/form-data"))
    return { ok: false, res: problem(415, "unsupported_media_type", "Send multipart/form-data with image files.", CORS) };
  if (Number(req.headers.get("content-length") ?? 0) > names.length * maxBytes + 64_000)
    return { ok: false, res: problem(413, "too_large", `Each image must be ${maxBytes / 1e6} MB or smaller.`, CORS) };
  const form = await req.formData().catch(() => null);
  if (!form) return { ok: false, res: problem(400, "invalid_request", "Could not read the form data.", CORS) };
  const files: Buffer[] = [];
  for (const n of names) {
    const f = form.get(n);
    if (!(f instanceof Blob)) return { ok: false, res: problem(400, "missing_file", `Attach an image in the '${n}' field.`, CORS) };
    if (f.size > maxBytes) return { ok: false, res: problem(413, "too_large", `'${n}' is larger than ${maxBytes / 1e6} MB.`, CORS) };
    files.push(Buffer.from(await f.arrayBuffer()));
  }
  return { ok: true, files };
}
