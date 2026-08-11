import json
import sys

from execute import execute_request


def main() -> None:
    request = json.load(sys.stdin)
    result = execute_request(request)
    sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
