import { useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import AuthScreen from "./components/AuthScreen";
import SessionHub from "./components/SessionHub";
import CaptureSheet from "./components/CaptureSheet";
import { isConfigured, saveConfig } from "@/lib/config";

/*
  Top-level flow:
    not authed → AuthScreen (password verified server-side)
    authed     → SessionHub (home), with the capture wizard sliding up as a
                 bottom sheet over it when "New artwork" is tapped.

  The session list is in-memory only and resets on reload; saved records live in
  Airtable. A hidden file input drives the camera so capture opens with a photo.
*/
export default function App() {
  const [authed, setAuthed] = useState(isConfigured());
  const [rawUrl, setRawUrl] = useState(null); // non-null => sheet open
  const [session, setSession] = useState([]);
  const fileRef = useRef(null);

  function logout() {
    saveConfig({ appPassword: "" });
    setSession([]);
    setRawUrl(null);
    setAuthed(false);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawUrl(URL.createObjectURL(file));
    e.target.value = "";
  }

  function closeSheet() {
    if (rawUrl) URL.revokeObjectURL(rawUrl);
    setRawUrl(null);
  }

  function onSaved(summary) {
    setSession((prev) => [summary, ...prev]);
    if (rawUrl) URL.revokeObjectURL(rawUrl);
    setRawUrl(null);
  }

  if (!authed) {
    return <AuthScreen onAuthed={() => setAuthed(true)} />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      <SessionHub
        session={session}
        onNew={() => fileRef.current?.click()}
        onLogout={logout}
      />

      <AnimatePresence>
        {rawUrl && (
          <CaptureSheet rawUrl={rawUrl} onClose={closeSheet} onSaved={onSaved} />
        )}
      </AnimatePresence>
    </div>
  );
}
