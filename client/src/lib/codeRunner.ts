/**
 * Runs a user's solution against test cases inside a Web Worker, so an infinite loop can be
 * stopped by terminating the worker. JavaScript runs natively; Python runs on Pyodide, which is
 * downloaded once (about 10 MB) the first time Python is used.
 */

export type Language = "python" | "javascript";
export type CompareMode = "exact" | "unordered" | "groups";

export interface TestCase {
  args: unknown[];
  expected: unknown;
  hidden: boolean;
}

export interface TestResult {
  passed: boolean;
  output?: unknown;
  error?: string;
}

export interface RunResult {
  results: TestResult[];
  logs: string[];
  error?: string;
  timedOut?: boolean;
}

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const RUN_TIMEOUT_MS = { javascript: 5000, python: 10000 };
const LOAD_TIMEOUT_MS = 90000;

const JS_WORKER = `
self.onmessage = (e) => {
  const { code, fnName, tests } = e.data;
  const logs = [];
  const log = (...a) => { if (logs.length < 200) logs.push(a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ")); };
  let fn;
  try {
    fn = new Function("console", code + "\\n;return typeof " + fnName + " === 'function' ? " + fnName + " : undefined;")({ log, error: log, warn: log, info: log });
  } catch (err) {
    postMessage({ results: [], logs, error: String(err && err.message ? err.name + ": " + err.message : err) });
    return;
  }
  if (typeof fn !== "function") {
    postMessage({ results: [], logs, error: "Define a function named " + fnName + "." });
    return;
  }
  const results = tests.map((t) => {
    try {
      const out = fn(...structuredClone(t.args));
      return { ok: true, output: out === undefined ? null : JSON.parse(JSON.stringify(out)) };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.name + ": " + err.message : err) };
    }
  });
  postMessage({ results, logs });
};`;

const PY_HARNESS = `
import json, copy, sys, io, traceback
_p = json.loads(__payload)
_buf, _old = io.StringIO(), sys.stdout
sys.stdout = _buf
_results, _err = [], None
try:
    _ns = {}
    exec(_p["code"], _ns)
    _fn = _ns.get(_p["fnName"])
    if not callable(_fn):
        _err = "Define a function named " + _p["fnName"] + "."
    else:
        for _t in _p["tests"]:
            try:
                _out = _fn(*copy.deepcopy(_t["args"]))
                _results.append({"ok": True, "output": json.loads(json.dumps(_out, default=list))})
            except Exception as _e:
                _results.append({"ok": False, "error": type(_e).__name__ + ": " + str(_e)})
except Exception as _e:
    _err = "".join(traceback.format_exception_only(type(_e), _e)).strip()
finally:
    sys.stdout = _old
json.dumps({"results": _results, "logs": _buf.getvalue().splitlines()[:200], "error": _err})
`;

const PY_WORKER = `
importScripts(${JSON.stringify(PYODIDE_URL + "pyodide.js")});
const ready = loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_URL)} }).then(
  (py) => { postMessage({ type: "ready" }); return py; },
  (err) => { postMessage({ type: "loadError", error: String(err) }); throw err; },
);
self.onmessage = async (e) => {
  const py = await ready;
  py.globals.set("__payload", JSON.stringify(e.data));
  try {
    const out = JSON.parse(py.runPython(${JSON.stringify(PY_HARNESS)}));
    postMessage({ type: "done", ...out, error: out.error || undefined });
  } catch (err) {
    postMessage({ type: "done", results: [], logs: [], error: String(err) });
  }
};`;

const workerUrl = (src: string) => URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
let jsUrl: string | null = null;
let pyUrl: string | null = null;
let pyWorker: Worker | null = null;
let pyReady: Promise<Worker> | null = null;

/** Start (or reuse) the Python worker. Resolves when Pyodide has loaded. */
export function loadPython(): Promise<Worker> {
  if (pyReady) return pyReady;
  pyUrl ??= workerUrl(PY_WORKER);
  const worker = new Worker(pyUrl);
  pyWorker = worker;
  pyReady = new Promise<Worker>((resolve, reject) => {
    const timer = setTimeout(() => fail("Python took too long to load. Check your connection and try again."), LOAD_TIMEOUT_MS);
    const fail = (msg: string) => {
      clearTimeout(timer);
      worker.terminate();
      pyWorker = null;
      pyReady = null;
      reject(new Error(msg));
    };
    worker.onmessage = (e) => {
      if (e.data.type === "ready") {
        clearTimeout(timer);
        resolve(worker);
      } else if (e.data.type === "loadError") fail("Python could not be loaded in this browser. JavaScript still works.");
    };
    worker.onerror = () => fail("Python could not be loaded in this browser. JavaScript still works.");
  });
  return pyReady;
}

export const pythonLoaded = () => pyWorker !== null && pyReady !== null;

function runInWorker(worker: Worker, payload: unknown, timeoutMs: number, onTimeout: () => void): Promise<RawResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      onTimeout();
      resolve({ results: [], logs: [], timedOut: true });
    }, timeoutMs);
    worker.onmessage = (e) => {
      if (e.data.type && e.data.type !== "done") return;
      clearTimeout(timer);
      resolve(e.data);
    };
    worker.postMessage(payload);
  });
}

interface RawResult {
  results: { ok: boolean; output?: unknown; error?: string }[];
  logs: string[];
  error?: string;
  timedOut?: boolean;
}

// ---------------------------------------------------------------- comparison
const canonical = (v: unknown): string => JSON.stringify(v);

function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    return deepEqual(ka, kb) && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

function normalise(value: unknown, mode: CompareMode): unknown {
  if (!Array.isArray(value)) return value;
  if (mode === "unordered") return [...value].sort((x, y) => canonical(x).localeCompare(canonical(y)));
  if (mode === "groups")
    return value
      .map((g) => (Array.isArray(g) ? [...g].sort((x, y) => canonical(x).localeCompare(canonical(y))) : g))
      .sort((x, y) => canonical(x).localeCompare(canonical(y)));
  return value;
}

export const matches = (got: unknown, expected: unknown, mode: CompareMode) => deepEqual(normalise(got, mode), normalise(expected, mode));

/** Run `code` against `tests` and grade each result. */
export async function runTests(language: Language, code: string, fnName: string, tests: TestCase[], compare: CompareMode): Promise<RunResult> {
  if (!/^[A-Za-z_$][\w$]*$/.test(fnName)) throw new Error("Invalid function name");
  const payload = { code, fnName, tests: tests.map((t) => ({ args: t.args })) };
  let raw: RawResult;
  if (language === "javascript") {
    jsUrl ??= workerUrl(JS_WORKER);
    const worker = new Worker(jsUrl);
    raw = await runInWorker(worker, payload, RUN_TIMEOUT_MS.javascript, () => undefined);
    worker.terminate();
  } else {
    const worker = await loadPython();
    raw = await runInWorker(worker, payload, RUN_TIMEOUT_MS.python, () => {
      pyWorker = null;
      pyReady = null; // a stuck interpreter is discarded; the next run reloads it (from the browser cache)
    });
  }
  if (raw.timedOut) {
    const secs = RUN_TIMEOUT_MS[language] / 1000;
    return { results: [], logs: [], timedOut: true, error: `Time limit exceeded (${secs}s). Look for an infinite loop or a slow algorithm.` };
  }
  if (raw.error) return { results: [], logs: raw.logs ?? [], error: raw.error };
  return {
    logs: raw.logs ?? [],
    results: raw.results.map((r, i) =>
      r.ok ? { passed: matches(r.output, tests[i].expected, compare), output: r.output } : { passed: false, error: r.error },
    ),
  };
}
