import { useRef, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import SessionHub from "./components/SessionHub";
import CaptureWizard from "./components/CaptureWizard";
import { isConfigured, saveConfig } from "@/lib/config";

/*
  Top-level flow:
    not authed → AuthScreen (enter app password, verified server-side)
    authed:
      "hub"     → SessionHub: home base, list of pieces saved this session
      "capture" → CaptureWizard: the 3-step flow for one piece

  The session list is in-memory only and resets on reload; saved records live in
  Airtable. A hidden file input drives the camera so "New artwork" can open the
  capture flow with the raw photo.
*/
export default function App() {
  const [authed, setAuthed] = useState(isConfigured());
  const [view, setView] = useState("hub");
  const [rawUrl, setRawUrl] = useState(null);
  const [session, setSession] = useState([]);
  const fileRef = useRef(null);

  function logout() {
    saveConfig({ appPassword: "" });
    setSession([]);
    setView("hub");
    setAuthed(false);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawUrl(URL.createObjectURL(file));
    setView("capture");
    e.target.value = "";
  }

  function closeWizard() {
    if (rawUrl) URL.revokeObjectURL(rawUrl);
    setRawUrl(null);
    setView("hub");
  }

  function onSaved(summary) {
    setSession((prev) => [summary, ...prev]);
    if (rawUrl) URL.revokeObjectURL(rawUrl);
    setRawUrl(null);
    setView("hub");
  }

  if (!authed) {
    return <AuthScreen onAuthed={() => setAuthed(true)} />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 py-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      {view === "hub" && (
        <SessionHub
          session={session}
          onNew={() => fileRef.current?.click()}
          onLogout={logout}
        />
      )}

      {view === "capture" && rawUrl && (
        <CaptureWizard
          rawUrl={rawUrl}
          onClose={closeWizard}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
