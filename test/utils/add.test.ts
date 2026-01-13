import { describe, it, expect } from 'vitest';
import { add, addOneAndOne } from '../../src/utils/add';

describe('Add Utility', () => {
  it('should add two numbers correctly', () => {
    expect(add(1, 1)).toBe(2);
    expect(add(5, 7)).toBe(12);
    expect(add(-3, 3)).toBe(0);
  });

  it('should add 1 and 1 correctly', () => {
    expect(addOneAndOne()).toBe(2);
  });
});