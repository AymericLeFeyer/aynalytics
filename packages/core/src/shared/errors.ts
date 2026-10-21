/** Erreur metier : message sur pour etre renvoye au client (400/404...). */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
