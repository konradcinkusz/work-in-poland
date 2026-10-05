import { existsSync } from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

/**
 * Health for Fly. Unlike the index page it does not depend on the backend, but it does fail when
 * the build output is missing or broken (a production server without its BUILD_ID cannot serve).
 */
export function GET(): Response {
  const production = process.env.NODE_ENV === 'production';
  const buildOk = !production || existsSync(path.join(process.cwd(), '.next', 'BUILD_ID'));
  return Response.json(
    { status: buildOk ? 'ok' : 'broken-build' },
    { status: buildOk ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
