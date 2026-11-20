import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow Next internals, static files, and public auth pages.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/)
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // Cloud auth not configured: allow access so the app can show setup state.
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Unauthenticated users must sign in (except login page).
  if (!user) {
    if (pathname.startsWith("/login")) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated: determine membership state.
  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_state,role")
    .eq("id", user.id)
    .maybeSingle();

  const approved = profile?.membership_state === "approved";
  const isAdmin = approved && profile?.role === "admin";

  // Pending/denied members can only access pending and login pages.
  if (!approved) {
    if (pathname.startsWith("/pending") || pathname.startsWith("/login")) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Membership approval required." }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  // Approved members: keep them out of pending, gate admin.
  if (pathname.startsWith("/pending")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
