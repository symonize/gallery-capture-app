import { useState } from "react";
import {
  Sheet,
  SheetTrigger,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetPanel,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getConfig, saveConfig } from "@/lib/config";

export default function Settings({ onSaved }) {
  const [c, setC] = useState(getConfig());
  const set = (k) => (e) => setC((p) => ({ ...p, [k]: e.target.value }));

  function save() {
    saveConfig(c);
    onSaved?.();
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm">Settings</Button>} />
      <SheetPopup side="right">
        <SheetHeader>
          <SheetTitle>API keys &amp; Airtable</SheetTitle>
          <SheetDescription>
            Stored locally on this device. See the README security note before
            sharing this app with others.
          </SheetDescription>
        </SheetHeader>
        <SheetPanel className="flex flex-col gap-4 p-4">
          <Field>
            <FieldLabel>OpenAI API key (Whisper)</FieldLabel>
            <Input type="password" value={c.openaiKey} onChange={set("openaiKey")} placeholder="sk-…" />
          </Field>
          <Field>
            <FieldLabel>Anthropic API key (Claude)</FieldLabel>
            <Input type="password" value={c.anthropicKey} onChange={set("anthropicKey")} placeholder="sk-ant-…" />
          </Field>
          <Field>
            <FieldLabel>Airtable personal access token</FieldLabel>
            <Input type="password" value={c.airtableToken} onChange={set("airtableToken")} placeholder="pat…" />
          </Field>
          <Field>
            <FieldLabel>Airtable Base ID</FieldLabel>
            <Input value={c.airtableBaseId} onChange={set("airtableBaseId")} placeholder="app…" />
            <FieldDescription>Find it in the Airtable API docs for your base.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Claude model</FieldLabel>
            <Input value={c.claudeModel} onChange={set("claudeModel")} />
          </Field>
        </SheetPanel>
        <SheetFooter>
          <SheetClose render={<Button onClick={save}>Save</Button>} />
          <SheetClose render={<Button variant="ghost">Cancel</Button>} />
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
