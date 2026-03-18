import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/api'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow the root path (it handles redirect in-page)
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Check for auth token in cookies or try localStorage via header
  const token = request.cookies.get('aarokya_cc_token')?.value;

  if (!token) {
    // For client-side navigation, the token is in localStorage.
    // Middleware runs on the server, so we check for the cookie.
    // If no cookie, we allow the request through and let client-side
    // auth handle the redirect (via useAuthStore).
    // For a stricter approach, set the token as an httpOnly cookie on login.
    return NextResponse.next();
  }

  // Verify token is not expired
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000;
    if (Date.now() >= expiry) {
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('aarokya_cc_token');
      return response;
    }
  } catch {
    // Invalid token format, redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
