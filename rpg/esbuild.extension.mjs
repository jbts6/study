import { build } from "esbuild";
import { cp, rm } from "node:fs/promises";

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

await rm("dist/go-runtime", { recursive: true, force: true });
await cp("src/runners/go/runtime", "dist/go-runtime", { recursive: true });
