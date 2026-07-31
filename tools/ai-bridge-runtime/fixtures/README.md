# Slice B Contract Fixtures

These files are path-only, credential-free contract fixtures for the Slice B.5
one-shot WorkBuddy contract check. They are not proof that WorkBuddy execution
is connected.

`C:/LCOS_MVP_SAMPLE/` is a non-user placeholder root. A later one-shot test must
materialize an equivalent envelope under an explicitly approved disposable
runtime root.

The Task fingerprint is SHA-256 over canonical UTF-8 JSON after:

1. removing `requestFingerprint`;
2. normalizing absolute path separators and dot segments;
3. sorting object keys recursively;
4. preserving array order;
5. encoding without insignificant whitespace or ASCII escaping.
