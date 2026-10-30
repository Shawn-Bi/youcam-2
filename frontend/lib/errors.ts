import type { FieldErrors, Item } from "./types";

/** The backend failed, or (when `network` is true) could not be reached at all. */
export class ApiError extends Error {
  constructor(
    message: string,
    public network = false,
  ) {
    super(message);
  }
}

/**
 * The backend rejected some fields (HTTP 422). The brief form shows each field's message
 * next to its field; any other screen shows them together as one message.
 */
export class ValidationError extends ApiError {
  constructor(public fields: FieldErrors) {
    super(Object.values(fields).join(" ") || "Some fields need attention.");
  }
}

/** The requested size is not in stock (HTTP 409); the store suggests alternatives. */
export class OutOfStockError extends Error {
  constructor(public alternatives: Item[]) {
    super("That size is out of stock.");
  }
}
