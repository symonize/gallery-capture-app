import { motion } from "motion/react";
import { ImagePlus, Users, LayoutGrid, Library, Settings } from "lucide-react";
import { springSnappy, springBouncy } from "@/lib/motion";

/*
  Floating pill nav (Figma). Five slots:
    capture (white, primary — opens the Add-artwork sheet)
    artists  (inert placeholder — no screen yet)
    home     (active indicator)
    collections (inert placeholder)
    settings (opens Settings)
  A shared-layout blue pill slides under the active item.
*/
export default function BottomNav({ active = "home", onCapture, onHome, onSettings }) {
  const items = [
    { key: "capture", icon: ImagePlus, primary: true, onClick: onCapture, label: "New artwork" },
    { key: "artists", icon: Users, disabled: true, label: "Artists (soon)" },
    { key: "home", icon: LayoutGrid, onClick: onHome, label: "Home" },
    { key: "collections", icon: Library, disabled: true, label: "Collections (soon)" },
    { key: "settings", icon: Settings, onClick: onSettings, label: "Settings" },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...springBouncy, delay: 0.1 }}
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-popover/90 p-1.5 shadow-2xl backdrop-blur-xl"
      >
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = active === it.key;

          if (it.primary) {
            return (
              <motion.button
                key={it.key}
                type="button"
                aria-label={it.label}
                onClick={it.onClick}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={springSnappy}
                className="mr-0.5 flex size-11 items-center justify-center rounded-full bg-white text-black shadow-lg"
              >
                <Icon className="size-5" strokeWidth={2.2} />
              </motion.button>
            );
          }

          return (
            <motion.button
              key={it.key}
              type="button"
              aria-label={it.label}
              onClick={it.disabled ? undefined : it.onClick}
              aria-disabled={it.disabled}
              whileTap={it.disabled ? undefined : { scale: 0.88 }}
              transition={springSnappy}
              className={
                "relative flex size-11 items-center justify-center rounded-full transition-colors " +
                (it.disabled
                  ? "text-muted-foreground/40"
                  : isActive
                    ? "text-white"
                    : "text-muted-foreground hover:text-white")
              }
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  transition={springSnappy}
                  className="absolute inset-0 rounded-full bg-primary"
                />
              )}
              <Icon className="relative size-5" strokeWidth={2} />
            </motion.button>
          );
        })}
      </motion.nav>
    </div>
  );
}
