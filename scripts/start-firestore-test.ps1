# Test server against the Firestore emulator (local E2E only).
$env:DB_BACKEND = "firestore"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:GOOGLE_CLOUD_PROJECT = "moneta-test"
npm run start -- -p 3120
