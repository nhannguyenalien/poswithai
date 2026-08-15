# Flutter release and OTA

The repository has two GitHub Actions workflows:

- `flutter-build-all.yml` analyzes and tests once, then builds Android, iOS,
  Windows and macOS in parallel. A successful run publishes one combined
  `multi-platform-latest` prerelease.
- `shorebird-ota.yml` creates Shorebird releases or patches for the same four
  platforms. Push-triggered OTA is deliberately limited to `mobile/lib/**`.

## One-time Shorebird setup

From the `mobile` directory, install Shorebird, sign in and initialize the app:

```sh
shorebird init
```

Commit the generated `mobile/shorebird.yaml`. In the Shorebird console, create
an API key, then add it to the GitHub repository as the Actions secret
`SHOREBIRD_TOKEN`. Add the repository Actions variable
`SHOREBIRD_ENABLED=true` only after both are present.

Run **Shorebird OTA - Android, iOS, Windows, macOS** manually with operation
`release` once for every new full application version. After that, Dart-only
changes under `mobile/lib` pushed to `main` or `codex/windows-release` create a
patch for all four platforms.

## What OTA can and cannot update

Shorebird patches Dart code. Native code, a new or upgraded native plugin,
platform configuration, signing, and bundled asset changes require a new full
release. Increment `version` in `mobile/pubspec.yaml`, run the full build, then
run the Shorebird workflow with operation `release`.

## Signing still required for public distribution

- Android currently uses a debug signing key even for release mode. Add a
  production keystore before Google Play distribution.
- iOS CI currently emits an unsigned `.app` archive, not an installable App
  Store/TestFlight IPA. Add an Apple distribution certificate, provisioning
  profile, and export options to create an IPA.
- macOS needs Developer ID signing and Apple notarization to avoid Gatekeeper
  warnings when distributed outside the App Store.
- Windows is currently a portable ZIP. Add an Authenticode certificate and an
  installer when distributing to customers.

Never put signing files, passwords, Shorebird API keys, or Apple credentials in
the repository. Store them in GitHub Actions secrets.
