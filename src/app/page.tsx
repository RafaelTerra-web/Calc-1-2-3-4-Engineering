import { StudyPlatform } from "@/components/features/study-platform";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { StudyUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabaseConfigured = isSupabaseConfigured();
  let initialUser: StudyUser | null = null;

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    if (user && supabase) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, role, created_at")
        .eq("id", user.id)
        .maybeSingle();
      const email = profile?.email ?? user.email ?? "";

      initialUser = {
        id: user.id,
        name:
          profile?.name ??
          user.user_metadata?.name ??
          user.user_metadata?.full_name ??
          email ??
          "Aluno",
        email,
        role: profile?.role === "admin" ? "admin" : "student",
        createdAt: profile?.created_at ?? user.created_at,
      };
    }
  }

  return (
    <StudyPlatform
      initialRoute={{
        view: firstParam(params.view),
        course: firstParam(params.course),
        topic: firstParam(params.topic),
      }}
      initialUser={initialUser}
      supabaseConfigured={supabaseConfigured}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
