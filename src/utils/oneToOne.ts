/**
 * Creates a one-to-one mapping function
 * @param input Input array to be mapped
 * @returns An array with each element mapped to itself
 */
export function oneToOne<T>(input: T[]): T[] {
  // Validate input
  if (!Array.isArray(input)) {
    throw new TypeError('Input must be an array');
  }

  // Create a direct one-to-one mapping
  return input.map(item => item);
}