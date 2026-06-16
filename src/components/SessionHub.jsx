import { Button } from "@/components/ui/button";
import Settings from "./Settings";

/*
  Home base between captures. Shows the running list of pieces saved this
  session and the primary "New artwork" action. Session is in-memory only, so
  this resets on reload — the records themselves are safe in Airtable.
*/
export default function SessionHub({
  configured,
  onConfigured,
  session,
  onNew,
}) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Gallery Capture
          </h1>
          <p className="text-xs text-muted-foreground">
            {session.length > 0
              ? `${session.length} captured this session`
              : "Photo → straighten → speak → save"}
          </p>
        </div>
        <Settings onSaved={onConfigured} />
      </header>

      {!configured && (
        <div className="rounded-md border bg-muted/40 p-4 text-sm">
          Add your API keys in <strong>Settings</strong> (OpenAI, Anthropic,
          Airtable token + base ID) to get started.
        </div>
      )}

      {/* session list */}
      <div className="flex flex-1 flex-col gap-2">
        {session.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <span className="text-4xl">🖼️</span>
            <p className="text-sm">No pieces captured yet.</p>
            <p className="max-w-xs text-xs">
              Tap “New artwork” to photograph a piece, straighten it, and dictate
              the details.
            </p>
          </div>
        ) : (
          session.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-2 text-left"
            >
              {item.thumbUrl ? (
                <img
                  src={item.thumbUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <div className="size-12 shrink-0 rounded-md border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.artist || "Unknown artist", item.year]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="text-xs text-success">✓ saved</span>
            </div>
          ))
        )}
      </div>

      {/* primary action, pinned at the bottom for thumb reach */}
      <Button
        size="lg"
        className="w-full"
        onClick={onNew}
        disabled={!configured}
      >
        📷 New artwork
      </Button>
    </div>
  );
}
