# B4 Remaining Non-blocking Debt

These items do not change B4 contracts but should be tracked after external verification.

1. **Secure credential UX**: current provider keys are server environment/config only. Do not store raw keys in Project DB. Desktop Runtime Host should later expose OS-protected credential storage.
2. **Provider Settings UI**: current GUI shows active Utility provider/model but does not provide full key/model editing. Add only after secure credential boundary exists.
3. **Provider health/cooldown**: fallback works per request. Future runtime may add short provider failure cooldown / circuit breaker to avoid repeatedly hitting an unavailable paid endpoint.
4. **Evaluation calibration**: confidence thresholds and evidence weights must be tuned from real project logs, not folklore.
5. **Attention Lens visual polish**: current marks are intentionally restrained. Final motion/visual language is not a B4 logic blocker.
6. **Large-canvas performance**: spatial provider is bounded but needs real 1k+/10k entity benchmarks later.
7. **Full npm validation**: blocked in this sandbox; mandatory on development machine before accepting Closure as release-ready.
