/** Error esperado con su código HTTP. app.ts lo convierte en { error: message } */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
