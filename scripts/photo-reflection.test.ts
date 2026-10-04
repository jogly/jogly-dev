import { expect, test } from "bun:test";
import { reflectionBlend } from "../src/lib/photoReflection";

test("reflection follows the carousel position, including a reversed swipe", () => {
	expect(reflectionBlend(0, 3)).toEqual({ from: 0, to: 1, mix: 0 });
	expect(reflectionBlend(0.25, 3)).toEqual({ from: 0, to: 1, mix: 0.5 });
	expect(reflectionBlend(0.375, 3)).toEqual({ from: 0, to: 1, mix: 0.75 });
	expect(reflectionBlend(0.125, 3)).toEqual({ from: 0, to: 1, mix: 0.25 });
	expect(reflectionBlend(0.5, 3)).toEqual({ from: 1, to: 2, mix: 0 });
});

test("edge overscroll and single-photo albums cannot select an invalid source", () => {
	expect(reflectionBlend(-0.2, 48)).toEqual({ from: 0, to: 1, mix: 0 });
	expect(reflectionBlend(1.2, 48)).toEqual({ from: 47, to: 47, mix: 0 });
	expect(reflectionBlend(0.7, 1)).toEqual({ from: 0, to: 0, mix: 0 });
});
