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
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { getTheme, setTheme } from "@/lib/theme";

/*
  Settings sheet: theme toggle + log out. The app password is entered on the
  AuthScreen, not here — logging out clears it and returns to that screen.
*/
export default function Settings({ onLogout }) {
  const [theme, setThemeState] = useState(getTheme());

  // Theme applies immediately and persists.
  function chooseTheme(next) {
    setThemeState(setTheme(next));
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm">Settings</Button>} />
      <SheetPopup side="right">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Appearance and account for this device.
          </SheetDescription>
        </SheetHeader>
        <SheetPanel className="flex flex-col gap-4 p-4">
          <Field>
            <FieldLabel>Theme</FieldLabel>
            <div className="inline-flex w-full rounded-md border p-0.5">
              <Button
                className="flex-1"
                size="sm"
                variant={theme === "dark" ? "default" : "ghost"}
                onClick={() => chooseTheme("dark")}
              >
                🌙 Dark
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant={theme === "light" ? "default" : "ghost"}
                onClick={() => chooseTheme("light")}
              >
                ☀️ Light
              </Button>
            </div>
          </Field>
        </SheetPanel>
        <SheetFooter>
          <SheetClose
            render={
              <Button variant="outline" onClick={onLogout}>
                Log out
              </Button>
            }
          />
          <SheetClose render={<Button variant="ghost">Close</Button>} />
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
