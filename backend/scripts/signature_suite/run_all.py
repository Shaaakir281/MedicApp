import os
import sys

from start_signatures import run as start_signatures
from fetch_signatures import run as fetch_signatures
from check_access import run as check_access


def main():
    results = start_signatures()
    fetch_signatures()
    ok = True
    for entry in results:
        doc_id = entry.get('document_signature_id')
        if not doc_id:
            continue
        ok = check_access(document_signature_id=doc_id) and ok
    if not ok:
        sys.exit(3)


if __name__ == '__main__':
    main()
