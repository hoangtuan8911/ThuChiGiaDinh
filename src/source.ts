import app from "./App.tsx?raw";
import calc from "./calc.ts?raw";
import money from "./money.ts?raw";
import mutate from "./mutate.ts?raw";

export const SOURCE = [
  ["src/App.tsx", app],
  ["src/calc.ts", calc],
  ["src/money.ts", money],
  ["src/mutate.ts", mutate],
]
  .map(([name, text]) => `/* ${name} */\n${text}`)
  .join("\n\n");
