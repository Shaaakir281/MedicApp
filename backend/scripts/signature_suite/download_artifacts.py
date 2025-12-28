import os
import sys
import requests


def _get_env(name, default=None, required=False):
    value = os.getenv(name, default)
    if required and not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def _as_bool(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


def run(document_signature_id=None, file_kind=None, allow_404=None):
    base_url = _get_env('API_BASE_URL', 'http://localhost:8000')
    token = _get_env('API_TOKEN', required=True)
    if document_signature_id is None:
        document_signature_id = _get_env('DOCUMENT_SIGNATURE_ID', required=True)
    if file_kind is None:
        file_kind = _get_env('FILE_KIND', 'final')
    if allow_404 is None:
        allow_404 = _as_bool(_get_env('ALLOW_404', '0'))

    headers = {
        'Authorization': f'Bearer {token}',
    }
    url = f"{base_url}/signature/document/{document_signature_id}/file/{file_kind}?inline=true"
    resp = requests.get(url, headers=headers, timeout=30)
    if resp.status_code == 200:
        print(f"download ok: document_signature_id={document_signature_id} file_kind={file_kind} bytes={len(resp.content)}")
        return True
    if resp.status_code == 404 and allow_404:
        print(f"download pending (404 allowed): document_signature_id={document_signature_id} file_kind={file_kind}")
        return True
    print(f"download failed: {resp.status_code} {resp.text}")
    return False


if __name__ == '__main__':
    ok = run()
    sys.exit(0 if ok else 3)
