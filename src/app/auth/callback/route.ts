import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedPath = requestUrl.searchParams.get("next") ?? "/redefinir-senha";
  const nextPath =
    requestedPath.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/redefinir-senha";

  if (!code) {
    return NextResponse.redirect(
      new URL("/redefinir-senha?erro=link-invalido", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { error } = supabase
    ? await supabase.auth.exchangeCodeForSession(code)
    : { error: new Error("Supabase não configurado") };

  if (error) {
    return NextResponse.redirect(
      new URL("/redefinir-senha?erro=link-expirado", requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
