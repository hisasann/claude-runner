import { oneToOne } from '../../src/utils/oneToOne';
import { describe, it, expect } from 'vitest';

describe('oneToOne function', () => {
  it('should return the same input for various types', () => {
    // Test with different types
    expect(oneToOne(42)).toBe(42);
    expect(oneToOne('hello')).toBe('hello');
    expect(oneToOne(true)).toBe(true);
    expect(oneToOne(null)).toBe(null);
    expect(oneToOne(undefined)).toBe(undefined);

    // Test with objects and arrays
    const obj = { key: 'value' };
    expect(oneToOne(obj)).toBe(obj);

    const arr = [1, 2, 3];
    expect(oneToOne(arr)).toBe(arr);
  });
});