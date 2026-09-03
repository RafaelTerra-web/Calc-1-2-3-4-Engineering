"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/features/brand-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetForm({ linkError }: { linkError?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [checkingSession, setCheckingSession] = useState(
    !linkError && Boolean(supabase),
  );
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError
      ? "O link é inválido ou expirou. Solicite um novo e-mail de recuperação."
      : supabase
        ? null
        : "A recuperação de senha não está configurada.",
  );
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (linkError) return;

    if (!supabase) return;

    async function validateRecoverySession() {
      const { data, error: sessionError } = await supabase.auth.getUser();
      setHasRecoverySession(Boolean(data.user) && !sessionError);
      if (sessionError || !data.user) {
        setError("O link é inválido ou expirou. Solicite um novo e-mail de recuperação.");
      }
      setCheckingSession(false);
    }

    void validateRecoverySession();
  }, [linkError, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    if (!supabase) {
      setError("A recuperação de senha não está configurada.");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setPending(false);
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut();
    window.setTimeout(() => router.replace("/?senha=atualizada"), 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        <Card className="rounded-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle>Definir nova senha</CardTitle>
            <CardDescription>
              Crie uma senha com pelo menos 8 caracteres e confirme para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checkingSession ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Validando o link de recuperação...
              </div>
            ) : success ? (
              <Alert className="rounded-md">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Senha atualizada</AlertTitle>
                <AlertDescription>Você será redirecionado para entrar novamente.</AlertDescription>
              </Alert>
            ) : hasRecoverySession ? (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    autoComplete="new-password"
                    disabled={pending}
                    id="new-password"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    autoComplete="new-password"
                    disabled={pending}
                    id="confirm-password"
                    minLength={8}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    type="password"
                    value={confirmation}
                  />
                </div>
                {error && <ErrorAlert message={error} />}
                <Button className="w-full" disabled={pending} type="submit">
                  {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Salvar nova senha
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                {error && <ErrorAlert message={error} />}
                <Button className="w-full" onClick={() => router.push("/")}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Voltar e solicitar novo link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert className="rounded-md" variant="destructive">
      <CircleAlert className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Não foi possível redefinir</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
