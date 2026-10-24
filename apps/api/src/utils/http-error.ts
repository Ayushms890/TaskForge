export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(code: string, message: string) {
    super(401, code, message);
  }
}

export class ConflictError extends HttpError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(code: string, message: string) {
    super(403, code, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(code: string, message: string) {
    super(404, code, message);
  }
}
