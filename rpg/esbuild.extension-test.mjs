import { build } from "esbuild";

await build({
  entryPoints: ["src/vscode/test/suite.ts"],
  outfile: "dist/extension-test.cjs",
  bundle: true,
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node20",
  logLevel: "info",
});
