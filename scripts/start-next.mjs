import { spawn } from "node:child_process";

const fallbackPort = process.argv[2] ?? "3000";
const port = process.env.PORT ?? fallbackPort;

const child = spawn("next", ["start", "--hostname", "0.0.0.0", "--port", port], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
