import { build } from "esbuild";

await build({
  entryPoints: ["src/vscode/webview/main.ts"],
  outfile: "dist/webview.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
});
