import { build } from "esbuild";

await build({
  entryPoints: ["src/vscode/extension.ts"],
  outfile: "dist/extension.cjs",
  bundle: true,
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
});
