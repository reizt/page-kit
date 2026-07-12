export type ErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_URL"
  | "BLOCKED_URL"
  | "TIMEOUT"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "RESPONSE_TOO_LARGE"
  | "FETCH_FAILED"
  | "RENDER_FAILED"
  | "PARSE_FAILED";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 500,
  ) {
    super(message);
  }
}
