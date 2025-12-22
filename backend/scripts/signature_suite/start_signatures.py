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
    signer_role = _get_env('SIGNER_ROLE', 'parent1')
    mode = _get_env('SIGN_MODE', 'remote')
    doc_types = _get_env(
        'DOC_TYPES',
        'surgical_authorization_minor,informed_consent,fees_consent_quote',
    )
    doc_types = [item.strip() for item in doc_types.split(',') if item.strip()]

    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }

    results = []
    for doc_type in doc_types:
        payload = {
            'procedure_case_id': int(case_id),
            'document_type': doc_type,
            'signer_role': signer_role,
            'mode': mode,
        }
        resp = requests.post(f"{base_url}/signature/start-document", json=payload, headers=headers, timeout=30)
        if resp.status_code >= 400:
            print(f"start-document failed for {doc_type}: {resp.status_code} {resp.text}")
            sys.exit(2)
        data = resp.json()
        results.append(data)
        print(f"started {doc_type}: id={data.get('document_signature_id')} link={data.get('signature_link')}")

    return results


if __name__ == '__main__':
    run()
