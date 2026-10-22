"""Domain errors raised by services. `app.main` maps them to HTTP responses."""


class ServiceError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NotFoundError(ServiceError):
    pass


class ConflictError(ServiceError):
    pass


class AuthError(ServiceError):
    pass
