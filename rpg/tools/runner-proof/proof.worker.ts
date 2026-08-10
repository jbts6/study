import * as Comlink from "comlink";
import {
  defaultPyodideLoader,
  initPyodide,
  pyodideExpose,
} from "pyodide-worker-runner";

type Pyodide = Awaited<ReturnType<typeof defaultPyodideLoader>>;

interface PyProxyLike {
  destroy(): void;
  toJs(options?: Record<string, unknown>): unknown;
}

const pyodidePromise = initializePyodide();

async function initializePyodide(): Promise<Pyodide> {
  const pyodide = await defaultPyodideLoader("314.0.3");

  initPyodide(pyodide);
  return pyodide;
}

let runSerial = 0;

function validateRelativePath(fileName: string): string[] {
  const parts = fileName.split("/");

  if (
    !fileName ||
    fileName.startsWith("/") ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Invalid proof file path: ${fileName}`);
  }

  return parts;
}

function createRunDirectory(pyodide: Pyodide): string {
  let root: string;

  do {
    root = `/proof-${++runSerial}`;
  } while (pyodide.FS.analyzePath(root).exists);

  pyodide.FS.mkdir(root);
  return root;
}

function writeFiles(
  pyodide: Pyodide,
  root: string,
  files: Record<string, string>,
): void {
  for (const [fileName, source] of Object.entries(files)) {
    const parts = validateRelativePath(fileName);
    let directory = root;

    for (const part of parts.slice(0, -1)) {
      directory = `${directory}/${part}`;
      if (!pyodide.FS.analyzePath(directory).exists) {
        pyodide.FS.mkdir(directory);
      }
    }

    pyodide.FS.writeFile(`${root}/${fileName}`, source);
  }
}

function installInterruptBuffer(
  pyodide: Pyodide,
  interruptBuffer: Int32Array | null,
): void {
  if (interruptBuffer) {
    pyodide.setInterruptBuffer(interruptBuffer);
  }
}

function isPyProxy(value: unknown): value is PyProxyLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toJs" in value &&
    "destroy" in value &&
    typeof value.toJs === "function" &&
    typeof value.destroy === "function"
  );
}

function toJsonValue(value: unknown): unknown {
  let converted = value;

  if (isPyProxy(value)) {
    try {
      converted = value.toJs({ dict_converter: Object.fromEntries });
    } finally {
      value.destroy();
    }
  }

  const serialized = JSON.stringify(converted ?? null);
  return serialized === undefined ? null : JSON.parse(serialized);
}

async function runFiles(
  pyodide: Pyodide,
  files: Record<string, string>,
  entryFile: string,
): Promise<unknown> {
  validateRelativePath(entryFile);

  if (!(entryFile in files)) {
    throw new Error(`Proof entry file is missing: ${entryFile}`);
  }

  const root = createRunDirectory(pyodide);
  writeFiles(pyodide, root, files);
  const entryPath = `${root}/${entryFile}`;
  const runName = `proof_${runSerial}`;
  const script = [
    "import runpy",
    "import sys",
    `root = ${JSON.stringify(root)}`,
    `entry_path = ${JSON.stringify(entryPath)}`,
    `run_name = ${JSON.stringify(runName)}`,
    "def clear_proof_modules():",
    "    for name, module in list(sys.modules.items()):",
    "        module_file = getattr(module, '__file__', None)",
    "        if isinstance(module_file, str) and module_file.startswith('/proof-'):",
    "            sys.modules.pop(name, None)",
    "clear_proof_modules()",
    "sys.path.insert(0, root)",
    "try:",
    "    result = runpy.run_path(entry_path, run_name=run_name)['RESULT']",
    "finally:",
    "    if root in sys.path:",
    "        sys.path.remove(root)",
    "    clear_proof_modules()",
    "result",
  ].join("\n");

  return toJsonValue(await pyodide.runPythonAsync(script));
}

const api = {
  runtime: pyodideExpose(async (_extras) => {
    const pyodide = await pyodidePromise;
    return { runtime: pyodide.version };
  }),
  execute: pyodideExpose(async (extras, source: string) => {
    const pyodide = await pyodidePromise;

    installInterruptBuffer(pyodide, extras.interruptBuffer);
    return toJsonValue(await pyodide.runPythonAsync(source));
  }),
  writeAndImport: pyodideExpose(
    async (extras, files: Record<string, string>, entryFile: string) => {
      const pyodide = await pyodidePromise;

      installInterruptBuffer(pyodide, extras.interruptBuffer);
      return runFiles(pyodide, files, entryFile);
    },
  ),
};

Comlink.expose(api);
