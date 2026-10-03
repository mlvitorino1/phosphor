/** Only deliberate, user-facing messages may cross an API boundary. */
export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}
