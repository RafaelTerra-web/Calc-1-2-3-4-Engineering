import { PasswordResetForm } from "@/components/features/password-reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = Array.isArray(params.erro) ? params.erro[0] : params.erro;

  return <PasswordResetForm linkError={error} />;
}
