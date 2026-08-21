from __future__ import annotations


class BridgeError(RuntimeError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool,
        http_status: int = 400,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.http_status = http_status

    def as_dict(self) -> dict[str, object]:
        return {
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
        }
