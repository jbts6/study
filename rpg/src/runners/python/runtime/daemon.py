"""Daemon entry: read RunRequest JSON-lines from stdin, call execute_request, write RunResult JSON-lines to stdout."""

import json
import sys
from execute import execute_request


def _interrupted_result(request):
    return {
        "protocolVersion": 1,
        "runId": request.get("runId", ""),
        "attemptId": request.get("attemptId", ""),
        "executionStatus": "interrupted",
        "returnValue": None,
        "returnValueTraceSeq": None,
        "trace": [],
        "diagnostics": [
            {
                "code": "INTERRUPTED",
                "severity": "info",
                "message": "Python 运行已中断。",
                "recoveryAction": "修改代码后重新运行",
            }
        ],
        "streams": {"stdout": "", "stderr": "", "truncated": False},
        "metrics": {"durationMs": 0, "traceEvents": 0},
    }


def main():
    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request = None
        try:
            request = json.loads(line)
            result = execute_request(request)
        except KeyboardInterrupt:
            if isinstance(request, dict) and request.get("runId") and request.get("attemptId"):
                result = _interrupted_result(request)
            else:
                continue
        try:
            sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except KeyboardInterrupt:
            return


if __name__ == "__main__":
    main()
