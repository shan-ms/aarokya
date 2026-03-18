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

  // Check for auth token in cookies
  const token = request.cookies.get('aarokya_cc_token')?.value;

  if (token) {
    // Verify token is not expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000;
      if (Date.now() >= expiry) {
        // Token expired - redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('aarokya_cc_token');
        return response;
      }
      // Token valid - allow through
      return NextResponse.next();
    } catch {
      // Invalid token format, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('aarokya_cc_token');
      return response;
    }
  }

  // No cookie token - for client-side auth (localStorage), we allow through
  // and let the dashboard layout handle redirect via useAuthStore.
  // The middleware protects against server-side access with expired cookies.
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
