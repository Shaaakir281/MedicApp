Signature suite (granular documents)

Environment variables:
- API_BASE_URL: backend base url (default: http://localhost:8000)
- API_TOKEN: bearer token for a patient or practitioner
- PROCEDURE_CASE_ID: numeric case id
- SIGNER_ROLE: parent1 or parent2 (default: parent1)
- SIGN_MODE: remote or cabinet (default: remote)
- DOC_TYPES: comma-separated catalog types
- OTHER_TOKEN: optional token for access checks
- DOCUMENT_SIGNATURE_ID: optional when running check_access.py directly
- FILE_KIND: final, signed, or evidence (default: final)
- ALLOW_404: set to 1 to allow missing files in download_artifacts.py
- DOWNLOAD_ARTIFACTS: set to 1 to run download_artifacts in run_all.py

Scripts:
- start_signatures.py: starts signature requests for each doc type
- fetch_signatures.py: lists document signatures for the case
- check_access.py: verifies OTHER_TOKEN cannot access a document signature
- download_artifacts.py: downloads final/signed/evidence PDF (or allows 404)
- run_all.py: orchestrates start + list + access checks
