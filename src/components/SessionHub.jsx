import { useState } from "react";
import { motion } from "motion/react";
import { Paintbrush, Box } from "lucide-react";
import Settings from "./Settings";
import BottomNav from "./BottomNav";
import { listContainer, listItem, springGentle } from "@/lib/motion";

/*
  Home / hub (Figma "Cream Style"): greeting, big "Home" heading, a "Recent
  additions" list of pieces saved this session, and the floating bottom nav.
  Session is in-memory only and resets on reload — records are safe in Airtable.
*/
export default function SessionHub({ session, onNew, onLogout }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col pb-28">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springGentle}
        className="pt-2"
      >
        <p className="text-sm text-muted-foreground">
          Hello,{" "}
          <span className="text-foreground">welcome back</span>
        </p>
        <h1 className="mt-2 text-[35px] font-medium leading-none tracking-[-0.03em]">
          Home
        </h1>
      </motion.header>

      <p className="mt-7 text-sm">Recent additions</p>

      {session.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground"
        >
          <span className="text-4xl">🖼️</span>
          <p className="text-sm">No pieces captured yet.</p>
          <p className="max-w-xs text-xs">
            Tap the capture button below to photograph a piece, straighten it,
            and dictate the details.
          </p>
        </motion.div>
      ) : (
        <motion.ul
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="mt-3 flex flex-col gap-3"
        >
          {session.map((item) => {
            const TypeIcon = item.artType === "Sculpture" ? Box : Paintbrush;
            return (
              <motion.li
                key={item.id}
                variants={listItem}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 rounded-lg bg-card p-2"
              >
                {item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="size-12 shrink-0 rounded-md bg-accent" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-[11px] font-light text-muted-foreground">
                    {item.artist || "Unknown artist"}
                  </p>
                </div>
                <TypeIcon className="size-3.5 shrink-0 text-muted-foreground" />
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <BottomNav
        active="home"
        onCapture={onNew}
        onHome={() => {}}
        onSettings={() => setSettingsOpen(true)}
      />
      <Settings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onLogout={onLogout}
      />
    </div>
  );
}
