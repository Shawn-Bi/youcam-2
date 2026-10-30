import type { FieldErrors, Item } from "./types";

/** The backend rejected some fields (HTTP 422). */
export class ValidationError extends Error {
  constructor(public fields: FieldErrors) {
    super("Some fields need attention.");
  }
}

/** The requested size is not in stock (HTTP 409); the store suggests alternatives. */
export class OutOfStockError extends Error {
  constructor(public alternatives: Item[]) {
    super("That size is out of stock.");
  }
}

/** The backend failed, or (when `network` is true) could not be reached at all. */
export class ApiError extends Error {
  constructor(
    message: string,
    public network = false,
  ) {
    super(message);
  }
}
