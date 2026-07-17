import { describe, expect, it } from 'vitest';
import { insert } from '../src/record.js';

describe('known limitation: width subtyping defeats Lacks (DESIGN.md 4.3, 11章)', () => {
	it('insert overwrites a key that already exists at runtime but is invisible to the narrower static type', () => {
		const wide: { x: number; y: number } = { x: 9, y: 1 };
		// Width subtyping: a value with more fields than its declared type is
		// legal. `narrow`'s static type says "no x", but the underlying
		// object already has one (#15454, DESIGN 4.3節).
		const narrow: { y: number } = wide;
		expect(Object.hasOwn(narrow, 'x')).toBe(true);

		// Lacks<{y:number}, 'x'> resolves to `unknown` (satisfied) purely
		// from the static type, so this compiles as if 'x' were fresh.
		const result = insert(narrow, 'x', 2);

		// At runtime this is an overwrite of a pre-existing field, not the
		// addition of a genuinely new one, even though the type system
		// treated it as a fresh insert.
		expect(result.x).toBe(2);
		// insert is non-destructive (it spreads into a new object), so the
		// original object the Lacks check was blind to is untouched.
		expect(wide.x).toBe(9);
	});
});
