import { oneToOne } from '../../src/utils/oneToOne';
import { describe, it, expect } from 'vitest';

describe('oneToOne function', () => {
  it('should return an identical array for numbers', () => {
    const input = [1, 2, 3, 4, 5];
    const result = oneToOne(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input); // Ensure a new array is created
  });

  it('should return an identical array for strings', () => {
    const input = ['a', 'b', 'c'];
    const result = oneToOne(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('should return an identical array for mixed types', () => {
    const input = [1, 'a', true, { key: 'value' }];
    const result = oneToOne(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('should throw an error for non-array input', () => {
    expect(() => oneToOne(null as any)).toThrow(TypeError);
    expect(() => oneToOne(undefined as any)).toThrow(TypeError);
    expect(() => oneToOne('not an array' as any)).toThrow(TypeError);
  });

  it('should handle empty array', () => {
    const input: number[] = [];
    const result = oneToOne(input);
    expect(result).toEqual([]);
    expect(result).not.toBe(input);
  });
});