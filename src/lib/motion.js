/*
  Shared Motion.dev spring presets so motion feels consistent across the app.
  Expressive but clean — pronounced springs, fast settle.
*/

// Buttons, toggles, nav — quick and crisp.
export const springSnappy = { type: "spring", stiffness: 500, damping: 30 };

// Sheets, step transitions — smooth glide.
export const springGentle = { type: "spring", stiffness: 300, damping: 30 };

// Accents, pops (active step, mic) — a little bounce.
export const springBouncy = { type: "spring", stiffness: 400, damping: 14 };

// Standard interactive button feel.
export const tapScale = { whileHover: { scale: 1.03 }, whileTap: { scale: 0.96 } };

// Directional step variants for the wizard (custom = +1 next / -1 back).
export const stepVariants = {
  enter: (dir) => ({ x: dir > 0 ? 64 : -64, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -64 : 64, opacity: 0 }),
};

// Staggered list container + item (e.g. Recent additions).
export const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
export const listItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: springGentle },
};
