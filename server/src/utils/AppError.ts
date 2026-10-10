export class AppError extends Error {
  status: number;
  data?: Record<string, unknown>;

  // `data` is optional extra JSON sent with the message, e.g. the id of an existing issue.
  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}
