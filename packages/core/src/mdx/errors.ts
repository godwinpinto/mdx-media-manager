export type EditErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'INVALID' | 'UNSUPPORTED';

export class EditError extends Error {
  constructor(
    readonly code: EditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EditError';
  }
}
