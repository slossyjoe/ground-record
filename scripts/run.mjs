import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`This app needs Node.js 20 or newer. You have ${process.versions.node}.`);
  console.error("Install it from https://nodejs.org and run this command again.");
  process.exit(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: root,
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

if (!fs.existsSync(path.join(root, "node_modules", "next"))) {
  console.log("First run: installing the app’s libraries. This can take a few minutes.");
  await run("npm", ["install"]);
}

console.log("Updating the daily record from public sources…");
try {
  await run(process.execPath, [path.join(root, "scripts", "update-reports.mjs")]);
} catch {
  console.log("The update had a problem. Starting with the last saved reports.");
}

console.log("");
console.log("Ground Record is starting.");
console.log("Open http://localhost:4317 in your browser.");
console.log("Leave this window open. Press Ctrl+C when you want to stop.");
console.log("");

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", "--turbopack", "-H", "0.0.0.0", "-p", "4317"], {
  stdio: "inherit",
  cwd: root,
});
child.on("exit", (code) => process.exit(code ?? 0));
