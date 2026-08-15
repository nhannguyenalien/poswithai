# SpaceHuge POS Mobile

Flutter client for the shared POS API. The app never connects directly to PostgreSQL.

## Run locally

Start the Pages API from the repository root, then run Flutter with an explicit API URL:

```sh
npm run dev
cd mobile
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8788/api
```

For an Android emulator, use `http://10.0.2.2:8788/api`. A physical device needs the computer's LAN address or an HTTPS staging URL.

## Environments

Do not commit secrets or database URLs into this project. Select the API per build:

```sh
flutter run --dart-define=API_BASE_URL=https://staging.example.com/api
flutter build appbundle --dart-define=API_BASE_URL=https://api.example.com/api
```

Access and refresh tokens are stored with `flutter_secure_storage`. API requests time out after 10 seconds; GET requests and idempotent order/payment writes can retry safely.

## Quality checks

```sh
flutter analyze
flutter test
```
