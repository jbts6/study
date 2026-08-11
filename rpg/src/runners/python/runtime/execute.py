import contextlib
import io
import math
import os
import shutil
import sys
import tempfile
import time
import types
import uuid
from pathlib import Path
import importlib.abc
import importlib.util


BLOCKED_MODULES = frozenset({"js", "pyodide", "micropip", "socket", "ssl", "http", "urllib", "requests", "subprocess", "multiprocessing", "ctypes", "webbrowser"})
SAFE_ALLOWED_MODULES = frozenset({"math"})
SAFE_BUILTINS = {"__build_class__": __build_class__, "abs": abs, "all": all, "any": any, "AssertionError": AssertionError, "bool": bool, "dict": dict, "enumerate": enumerate, "Exception": Exception, "filter": filter, "float": float, "int": int, "len": len, "list": list, "map": map, "max": max, "min": min, "object": object, "print": print, "range": range, "reversed": reversed, "round": round, "set": set, "sorted": sorted, "str": str, "sum": sum, "tuple": tuple, "ValueError": ValueError, "zip": zip}
TRACE_STRING_LIMIT = 200
TRACE_COLLECTION_LIMIT = 20
TRACE_DEPTH_LIMIT = 3

ORIGINAL_IMPORT = __import__
TRACE_IS_FINITE = math.isfinite
TRACE_TYPE = type
TRACE_LEN = len
TRACE_LIST = list
TRACE_EXCEPTION_INIT = Exception.__init__
TRACE_ID = id
TRACE_MIN = min
TRACE_RANGE = range
TRACE_SET = set
TRACE_ENUMERATE = enumerate
TRACE_STRING = str
TRACE_DICT_ITEMS = dict.items
TRACE_BOOL_TYPE = bool
TRACE_INT_TYPE = int
TRACE_FLOAT_TYPE = float
TRACE_STR_TYPE = str
TRACE_LIST_TYPE = list
TRACE_TUPLE_TYPE = tuple
TRACE_DICT_TYPE = dict
TRACE_SET_TYPE = set
TRACE_FROZENSET_TYPE = frozenset


class ReturnNotSerializable(Exception):
    pass


class TraceLimitReached(Exception):
    def __init__(self, trace):
        TRACE_EXCEPTION_INIT(self, "TRACE_LIMIT_REACHED")
        self.trace = TRACE_LIST(trace)


def guarded_import(allowed_modules: set[str], player_module_roots: set[str]):
    def import_module(name, globals=None, locals=None, fromlist=(), level=0):
        root = name.split(".", 1)[0]
        if level or root in BLOCKED_MODULES or root not in allowed_modules | player_module_roots:
            raise RuntimeError(f"MODULE_NOT_ALLOWED:{root}")
        return ORIGINAL_IMPORT(name, globals, locals, fromlist, level)

    return import_module


def _validated_allowed_modules(request: dict[str, object]) -> set[str]:
    requested = set(request.get("allowedModules", []))
    unsupported = requested - SAFE_ALLOWED_MODULES
    if unsupported:
        raise RuntimeError("MODULE_NOT_ALLOWED:" + sorted(unsupported)[0])
    return requested


def _evict_allowed_modules(allowed_modules: set[str]) -> None:
    for name in tuple(sys.modules):
        root = name.split(".", 1)[0]
        if root in allowed_modules:
            del sys.modules[name]


def _reject_preloaded_module_collisions(player_module_roots: set[str]) -> None:
    preloaded_roots = {name.split(".", 1)[0].casefold() for name in sys.modules}
    collisions = {root for root in player_module_roots if root.casefold() in preloaded_roots}
    if collisions:
        raise RuntimeError("MODULE_NOT_ALLOWED:" + sorted(collisions)[0])


class RestrictedPlayerLoader(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def __init__(self, root: Path, guarded):
        self.root, self.guarded = root, guarded
        self.builtins = {**SAFE_BUILTINS, "__import__": guarded}

    def find_spec(self, fullname, path=None, target=None):
        relative = Path(*fullname.split("."))
        module_file = self.root / relative.with_suffix(".py")
        package_file = self.root / relative / "__init__.py"
        if module_file.is_file():
            return importlib.util.spec_from_file_location(fullname, module_file, loader=self)
        if package_file.is_file():
            return importlib.util.spec_from_file_location(fullname, package_file, loader=self, submodule_search_locations=[str(package_file.parent)])
        return None

    def create_module(self, spec):
        return types.ModuleType(spec.name)

    def exec_module(self, module):
        path = Path(module.__spec__.origin)
        module.__dict__.update({"__file__": str(path), "__package__": module.__spec__.parent, "__builtins__": self.builtins})
        exec(compile(path.read_text("utf-8"), str(path), "exec"), module.__dict__, module.__dict__)


def clip_utf8(text: str, limit: int) -> tuple[str, bool]:
    raw = text.encode("utf-8")
    limit = max(0, int(limit))
    if len(raw) <= limit:
        return text, False
    suffix = "\n...[output truncated]".encode("utf-8")
    if limit < len(suffix):
        return suffix[:limit].decode("utf-8", "ignore"), True
    prefix = raw[: limit - len(suffix)].decode("utf-8", "ignore")
    return prefix + suffix.decode("utf-8"), True


def json_value(value, depth, max_depth):
    kind = type(value)
    if depth >= max_depth:
        raise ReturnNotSerializable()
    if value is None or kind in (bool, int, str):
        return value
    if kind is float and math.isfinite(value):
        return value
    if kind in (list, tuple):
        return [json_value(item, depth + 1, max_depth) for item in value]
    if kind is dict and all(type(key) is str for key in value):
        return {key: json_value(value[key], depth + 1, max_depth) for key in value}
    raise ReturnNotSerializable()


def safe_value(value, depth=0, seen=None):
    seen = TRACE_SET() if seen is None else seen
    if depth >= TRACE_DEPTH_LIMIT:
        return "<truncated:depth>"
    value_type = TRACE_TYPE(value)
    if value is None or value_type is TRACE_BOOL_TYPE or value_type is TRACE_INT_TYPE:
        return value
    if value_type is TRACE_FLOAT_TYPE:
        return value if TRACE_IS_FINITE(value) else "<non-finite-float>"
    if value_type is TRACE_STR_TYPE:
        return value if TRACE_LEN(value) <= TRACE_STRING_LIMIT else value[:TRACE_STRING_LIMIT] + "<truncated:string>"
    if value_type not in (TRACE_LIST_TYPE, TRACE_TUPLE_TYPE, TRACE_DICT_TYPE, TRACE_SET_TYPE, TRACE_FROZENSET_TYPE):
        return "<unserializable>"
    identity = TRACE_ID(value)
    if identity in seen:
        return "<circular>"
    seen.add(identity)
    if value_type is TRACE_LIST_TYPE or value_type is TRACE_TUPLE_TYPE:
        rendered = [safe_value(value[index], depth + 1, seen) for index in TRACE_RANGE(TRACE_MIN(TRACE_LEN(value), TRACE_COLLECTION_LIMIT))]
        if TRACE_LEN(value) > TRACE_COLLECTION_LIMIT:
            rendered.append("<truncated:collection>")
        return rendered
    if value_type is TRACE_DICT_TYPE:
        rendered = {}
        for index, (key, item) in TRACE_ENUMERATE(TRACE_DICT_ITEMS(value)):
            if index == TRACE_COLLECTION_LIMIT:
                break
            safe_key = key if TRACE_TYPE(key) in (TRACE_STR_TYPE, TRACE_INT_TYPE, TRACE_FLOAT_TYPE, TRACE_BOOL_TYPE) else "<non-primitive-key>"
            rendered[TRACE_STRING(safe_key)] = safe_value(item, depth + 1, seen)
        if TRACE_LEN(value) > TRACE_COLLECTION_LIMIT:
            rendered["<truncated:collection>"] = True
        return rendered
    rendered = []
    for index, item in TRACE_ENUMERATE(value):
        if index == TRACE_COLLECTION_LIMIT:
            break
        rendered.append(safe_value(item, depth + 1, seen))
    if TRACE_LEN(value) > TRACE_COLLECTION_LIMIT:
        rendered.append("<truncated:collection>")
    return rendered


def error_result(request: dict[str, object], status: str, code: str, message: str, started: float, location=None, trace=None) -> dict[str, object]:
    diagnostic = {"code": code, "severity": "error", "message": message, "recoveryAction": "修改代码后重新运行"}
    if location is not None:
        diagnostic["location"] = location
    events = [] if trace is None else trace
    return {"protocolVersion": 1, "runId": request["runId"], "attemptId": request["attemptId"], "executionStatus": status, "returnValue": None, "trace": events, "diagnostics": [diagnostic], "streams": {"stdout": "", "stderr": "", "truncated": False}, "metrics": {"durationMs": int((time.perf_counter() - started) * 1000), "traceEvents": TRACE_LEN(events)}}


def syntax_error_result(request: dict[str, object], error: SyntaxError, started: float) -> dict[str, object]:
    filename = Path(error.filename).name if error.filename else request["entrypoint"]["file"]
    return error_result(request, "syntax_error", "PYTHON_SYNTAX_ERROR", "Python 语法错误。", started, {"file": filename, "line": error.lineno or 1, "column": error.offset or 1})


def trace_limit_result(request: dict[str, object], started: float, trace: list[dict[str, object]]) -> dict[str, object]:
    return error_result(request, "runtime_error", "TRACE_LIMIT_REACHED", "代码轨迹超过限制，运行已停止。", started, trace=trace)


def runtime_error_result(request: dict[str, object], code: str, message: str, started: float) -> dict[str, object]:
    return error_result(request, "runtime_error", code, message, started)


def _restore_modules(snapshot, original=None):
    target = original if original is not None else sys.modules
    if sys.modules is not target:
        sys.modules = target
    for name in tuple(target):
        if name not in snapshot:
            del target[name]
    target.update(snapshot)


def _safe_relative_path(root: Path, filename: str) -> Path:
    if not isinstance(filename, str) or not filename or "\\" in filename:
        raise RuntimeError("INVALID_PLAYER_FILE")
    relative = Path(filename)
    if relative.is_absolute() or any(part in ("", ".", "..") for part in relative.parts):
        raise RuntimeError("INVALID_PLAYER_FILE")
    destination = root.joinpath(*relative.parts)
    if root not in destination.parents and destination != root:
        raise RuntimeError("INVALID_PLAYER_FILE")
    return destination


def _write_player_files(root: Path, files) -> tuple[set[str], dict[str, str]]:
    player_module_roots = set()
    player_file_names = {}
    written_parents = set()
    for filename, source in files.items():
        destination = _safe_relative_path(root, filename)
        if not isinstance(source, str):
            raise RuntimeError("INVALID_PLAYER_FILE")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(source, encoding="utf-8")
        player_file_names[str(destination)] = filename
        parts = Path(filename).parts
        if parts:
            player_module_roots.add(parts[0].split(".", 1)[0])
        parent = destination.parent
        while parent != root and parent not in written_parents:
            (parent / "__init__.py").touch(exist_ok=True)
            written_parents.add(parent)
            parent = parent.parent
    return player_module_roots, player_file_names


def _entry_module_name(filename: str) -> str:
    return ".".join(Path(filename).with_suffix("").parts)


def _trace_function(player_files: dict[str, str], max_events: int):
    events = []
    depths = {}
    entry_trace = {"frame": None, "returnSeq": None}

    def trace(frame, event, argument):
        relative_path = player_files.get(frame.f_code.co_filename)
        if relative_path is None:
            return None
        frame_id = TRACE_ID(frame)
        if event == "call":
            depths[frame_id] = TRACE_LEN(depths)
            if entry_trace["frame"] is None:
                entry_trace["frame"] = frame_id
        if event not in ("call", "line", "return", "exception"):
            return trace
        if TRACE_LEN(events) >= max_events:
            raise TraceLimitReached(events)
        locals_snapshot = {name: safe_value(value) for name, value in frame.f_locals.items() if TRACE_TYPE(name) is TRACE_STR_TYPE and not name.startswith("_")}
        event_data = {"seq": TRACE_LEN(events) + 1, "file": relative_path, "line": frame.f_lineno, "event": event, "function": frame.f_code.co_name, "depth": depths.get(frame_id, 0), "locals": locals_snapshot}
        events.append(event_data)
        if event == "return":
            if entry_trace["frame"] == frame_id:
                entry_trace["returnSeq"] = event_data["seq"]
            depths.pop(frame_id, None)
        return trace

    return trace, events, entry_trace


def _load_entry(root: Path, entry_file: str, callable_name: str, builtins):
    entry_path = _safe_relative_path(root, entry_file)
    if not entry_path.is_file():
        raise RuntimeError("ENTRYPOINT_NOT_FOUND")
    module_name = _entry_module_name(entry_file)
    module = types.ModuleType(module_name)
    module.__dict__.update({"__name__": module_name, "__file__": str(entry_path), "__package__": module_name.rpartition(".")[0], "__builtins__": builtins})
    sys.modules[module_name] = module
    exec(compile(entry_path.read_text("utf-8"), str(entry_path), "exec"), module.__dict__, module.__dict__)
    target = module
    for component in callable_name.split("."):
        target = getattr(target, component)
    if not callable(target):
        raise RuntimeError("ENTRYPOINT_NOT_CALLABLE")
    return target


def _completed_result(request, started, value, events, return_trace_seq, stdout, stderr, limits):
    stdout_text, stdout_truncated = clip_utf8(stdout.getvalue(), int(limits["maxOutputBytes"]))
    stderr_text, stderr_truncated = clip_utf8(stderr.getvalue(), int(limits["maxOutputBytes"]))
    return {"protocolVersion": 1, "runId": request["runId"], "attemptId": request["attemptId"], "executionStatus": "completed", "returnValue": value, "returnValueTraceSeq": return_trace_seq, "trace": events, "diagnostics": [], "streams": {"stdout": stdout_text, "stderr": stderr_text, "truncated": stdout_truncated or stderr_truncated}, "metrics": {"durationMs": int((time.perf_counter() - started) * 1000), "traceEvents": len(events)}}


def execute_isolated_request(request: dict[str, object], started: float) -> dict[str, object]:
    run_id = str(request["runId"])
    attempt_id = str(request["attemptId"])
    safe_run = "".join(char if char.isalnum() else "-" for char in run_id)[-48:]
    safe_attempt = "".join(char if char.isalnum() else "-" for char in attempt_id)[-48:]
    root = Path(tempfile.mkdtemp(prefix=f"python-run-{safe_run}-{safe_attempt}-{uuid.uuid4().hex}-"))
    previous_cwd = os.getcwd()
    previous_path_object = sys.path
    previous_path = list(previous_path_object)
    previous_stdout = sys.stdout
    previous_stderr = sys.stderr
    previous_meta_path_object = sys.meta_path
    previous_meta_path = list(previous_meta_path_object)
    previous_modules = dict(sys.modules)
    previous_modules_object = sys.modules
    previous_trace = sys.gettrace()
    stdout = io.StringIO()
    stderr = io.StringIO()
    try:
        os.chdir(root)
        files = request.get("files", {})
        player_module_roots, player_file_names = _write_player_files(root, files)
        allowed = _validated_allowed_modules(request)
        _reject_preloaded_module_collisions(player_module_roots)
        _evict_allowed_modules(allowed)
        guarded = guarded_import(allowed, player_module_roots)
        loader = RestrictedPlayerLoader(root, guarded)
        sys.path.insert(0, str(root))
        sys.meta_path.insert(0, loader)
        sys.stdout = stdout
        sys.stderr = stderr
        limits = request["limits"]
        entrypoint = request["entrypoint"]
        entry = _load_entry(root, entrypoint["file"], entrypoint["callable"], loader.builtins)
        trace_function, events, entry_trace = _trace_function(player_file_names, int(limits["maxTraceEvents"]))
        sys.settrace(trace_function)
        try:
            raw_value = entry(request["worldView"])
        finally:
            sys.settrace(previous_trace)
        try:
            value = json_value(raw_value, 0, int(limits["maxValueDepth"]))
        except RecursionError as error:
            raise ReturnNotSerializable() from error
        return _completed_result(request, started, value, events, entry_trace["returnSeq"], stdout, stderr, limits)
    finally:
        sys.settrace(previous_trace)
        sys.stdout = previous_stdout
        sys.stderr = previous_stderr
        if sys.path is not previous_path_object:
            sys.path = previous_path_object
        previous_path_object[:] = previous_path
        if sys.meta_path is not previous_meta_path_object:
            sys.meta_path = previous_meta_path_object
        previous_meta_path_object[:] = previous_meta_path
        _restore_modules(previous_modules, previous_modules_object)
        os.chdir(previous_cwd)
        if root.exists():
            shutil.rmtree(root)


def execute_request(request: dict[str, object]) -> dict[str, object]:
    started = time.perf_counter()
    previous_trace = sys.gettrace()
    previous_cwd = os.getcwd()
    modules_before = dict(sys.modules)
    modules_before_object = sys.modules
    try:
        return execute_isolated_request(request, started)
    except KeyboardInterrupt:
        return {"protocolVersion": 1, "runId": request["runId"], "attemptId": request["attemptId"], "executionStatus": "interrupted", "returnValue": None, "trace": [], "diagnostics": [{"code": "INTERRUPTED", "severity": "info", "message": "Python 运行已中断。", "recoveryAction": "修改代码后重新运行"}], "streams": {"stdout": "", "stderr": "", "truncated": False}, "metrics": {"durationMs": int((time.perf_counter() - started) * 1000), "traceEvents": 0}}
    except SyntaxError as error:
        return syntax_error_result(request, error, started)
    except TraceLimitReached as error:
        return trace_limit_result(request, started, error.trace)
    except ReturnNotSerializable:
        return runtime_error_result(request, "RETURN_NOT_SERIALIZABLE", "入口函数必须返回 JSON 值。", started)
    except RuntimeError as error:
        code = "MODULE_NOT_ALLOWED" if str(error).startswith("MODULE_NOT_ALLOWED:") else "PYTHON_RUNTIME_ERROR"
        return runtime_error_result(request, code, "Python 运行失败。", started)
    except BaseException:
        return runtime_error_result(request, "PYTHON_RUNTIME_ERROR", "Python 运行失败。", started)
    finally:
        sys.settrace(previous_trace)
        os.chdir(previous_cwd)
        _restore_modules(modules_before, modules_before_object)
