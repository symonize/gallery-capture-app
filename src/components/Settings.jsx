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
          <SheetTitle>App access</SheetTitle>
          <SheetDescription>
            Enter the app password to use this device. API keys live securely on
            the server — they’re never stored in your browser.
          </SheetDescription>
        </SheetHeader>
        <SheetPanel className="flex flex-col gap-4 p-4">
          <Field>
            <FieldLabel>App password</FieldLabel>
            <Input
              type="password"
              value={c.appPassword}
              onChange={set("appPassword")}
              placeholder="••••••••"
            />
            <FieldDescription>
              Set by the site owner (the APP_PASSWORD env var). Stored on this
              device so you only enter it once.
            </FieldDescription>
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
