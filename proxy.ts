import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optional password for the whole app. Anyone who can open your deployment can
 * spend your Wiro AI balance, so set BASIC_AUTH_PASSWORD to keep a public URL
 * to yourself. The browser then asks for a password; any user name works.
 */
export function proxy(request: NextRequest) {
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!password) return NextResponse.next();

  const [scheme, encoded] = (request.headers.get('authorization') ?? '').split(' ');
  if (scheme?.toLowerCase() === 'basic' && encoded) {
    let decoded = '';
    try {
      decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)));
    } catch {
      decoded = '';
    }
    const separator = decoded.indexOf(':');
    if (separator !== -1 && constantTimeEqual(decoded.slice(separator + 1), password)) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Wiro AI Next.js Starter", charset="UTF-8"' },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

export const config = {
  // Everything except build assets and the icons and preview image that link previews fetch.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|opengraph-image).*)'],
};
