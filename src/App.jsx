import { useRef, useState } from "react";
import SessionHub from "./components/SessionHub";
import CaptureWizard from "./components/CaptureWizard";
import { isConfigured } from "@/lib/config";

/*
  Top-level view switch:
    "hub"     → SessionHub: home base, list of pieces saved this session
    "capture" → CaptureWizard: the 3-step flow for one piece

  The session list is in-memory only and resets on reload; saved records live in
  Airtable. A hidden file input drives the camera so "New artwork" can open the
  capture flow with the raw photo.
*/
export default function App() {
  const [configured, setConfigured] = useState(isConfigured());
  const [view, setView] = useState("hub");
  const [rawUrl, setRawUrl] = useState(null);
  const [session, setSession] = useState([]);
  const fileRef = useRef(null);

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
          configured={configured}
          onConfigured={() => setConfigured(isConfigured())}
          session={session}
          onNew={() => fileRef.current?.click()}
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
