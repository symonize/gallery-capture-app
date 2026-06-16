import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { saveConfig } from "@/lib/config";

/*
  Login gate shown before the app unlocks. Verifies the typed password against
  /api/verify (server checks it against APP_PASSWORD) and only stores it +
  unlocks on success, so a wrong password is caught here, not mid-capture.
*/
export default function AuthScreen({ onAuthed }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-password": password,
        },
      });
      if (res.status === 401) {
        setError("Incorrect password.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Error ${res.status}.`);
        return;
      }
      saveConfig({ appPassword: password });
      onAuthed?.();
    } catch (err) {
      setError(`Couldn't reach the server: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">🖼️</div>
          <h1 className="text-xl font-semibold tracking-tight">
            Gallery Capture
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the app password to continue.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel className="sr-only">App password</FieldLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="App password"
              autoFocus
              autoComplete="current-password"
            />
          </Field>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy || !password.trim()}>
            {busy ? <Spinner className="mr-2" /> : null}
            Unlock
          </Button>
        </form>
      </div>
    </div>
  );
}
