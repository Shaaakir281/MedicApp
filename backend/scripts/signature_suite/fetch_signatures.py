import os
import sys
import requests


def _get_env(name, default=None, required=False):
    value = os.getenv(name, default)
    if required and not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def run():
    base_url = _get_env('API_BASE_URL', 'http://localhost:8000')
    token = _get_env('API_TOKEN', required=True)
    case_id = _get_env('PROCEDURE_CASE_ID', required=True)

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }

    resp = requests.get(f"{base_url}/signature/case/{case_id}/documents", headers=headers, timeout=30)
    if resp.status_code >= 400:
        print(f"case documents failed: {resp.status_code} {resp.text}")
        sys.exit(2)
    data = resp.json()
    for doc in data.get('document_signatures', []):
        print(f"doc={doc.get('document_type')} id={doc.get('id')} status={doc.get('overall_status')}")
    return data


if __name__ == '__main__':
    run()
