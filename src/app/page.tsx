import { StudyPlatform } from "@/components/features/study-platform";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { StudyUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabaseConfigured = isSupabaseConfigured();
  let initialUser: StudyUser | null = null;

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    if (user) {
      initialUser = {
        id: user.id,
        name:
          user.user_metadata?.name ??
          user.user_metadata?.full_name ??
          user.email ??
          "Aluno",
        email: user.email ?? "",
        createdAt: user.created_at,
      };
    }
  }

  return (
    <StudyPlatform
      initialUser={initialUser}
      supabaseConfigured={supabaseConfigured}
    />
  );
}
