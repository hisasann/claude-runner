/**
 * Creates a one-to-one mapping function
 * @param input Input value to be mapped
 * @returns The same input value
 */
export function oneToOne<T>(input: T): T {
  return input;
}