import os
import sys
import requests


def _get_env(name, default=None, required=False):
    value = os.getenv(name, default)
    if required and not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def run(document_signature_id=None):
    base_url = _get_env('API_BASE_URL', 'http://localhost:8000')
    other_token = _get_env('OTHER_TOKEN')
    if not other_token:
        print('OTHER_TOKEN not set, skipping access check.')
        return True

    if document_signature_id is None:
        document_signature_id = _get_env('DOCUMENT_SIGNATURE_ID', required=True)

    headers = {
        'Authorization': f'Bearer {other_token}',
        'Content-Type': 'application/json',
    }

    resp = requests.get(
        f"{base_url}/signature/document/{document_signature_id}",
        headers=headers,
        timeout=30,
    )
    if resp.status_code == 403:
        print(f"access denied as expected for document_signature_id={document_signature_id}")
        return True
    print(f"unexpected access result: {resp.status_code} {resp.text}")
    return False


if __name__ == '__main__':
    ok = run()
    sys.exit(0 if ok else 3)
