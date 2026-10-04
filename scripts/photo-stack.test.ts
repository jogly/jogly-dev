import { expect, test } from "bun:test";
import { photoStack, photoViewport } from "../src/lib/photoStack";

test("viewport marker represents a partial image rather than its whole thumbnail", () => {
	expect(photoViewport([{ top: -300, height: 1200 }], 600)).toMatchObject({
		active: 0, first: 0, last: 0, start: 0.25, end: 0.75,
	});
});

test("one viewport marker spans portions of adjacent visible images", () => {
	expect(photoViewport([{ top: -400, height: 600 }, { top: 224, height: 800 }], 624)).toMatchObject({
		active: 1, first: 0, last: 1, start: 2 / 3, end: 0.5,
	});
	expect(photoViewport([{ top: 24, height: 300 }], 720)).toMatchObject({
		active: 0, first: 0, last: 0, start: 0, end: 1,
	});
	expect(photoViewport([], 720)).toBeNull();
	expect(photoViewport([{ top: 800, height: 300 }], 720)).toBeNull();
});

test("scroll position advances through the visible slice before the active photo changes", () => {
	const before = photoViewport([{ top: -100, height: 800 }, { top: 700, height: 800 }], 800)!;
	const during = photoViewport([{ top: -300, height: 800 }, { top: 500, height: 800 }], 800)!;
	const after = photoViewport([{ top: -500, height: 800 }, { top: 300, height: 800 }], 800)!;
	expect(before.active).toBe(during.active);
	expect(after.active).not.toBe(during.active);
	expect(before.position).toBeGreaterThan(0);
	expect(during.position).toBeGreaterThan(before.position);
	expect(after.position).toBeGreaterThan(during.position);
	expect(after.position).toBeLessThan(1);
});

test("marker travels, holds at the rail midpoint while sleeves scroll, then travels to the end", () => {
	const height = 656;
	const frame = (offset: number) => {
		const view = photoViewport(Array.from({ length: 48 }, (_, index) => ({
			top: index * 824 - offset, height: 800,
		})), 720)!;
		const cards = photoStack(48, view.position, height);
		const center = (cards[view.first].top + view.start * 56 + cards[view.last].top + view.end * 56) / 2;
		return { cards, center };
	};
	const start = frame(0);
	const early = frame(824);
	expect(early.center).toBeGreaterThan(start.center);
	expect(early.center).toBeLessThan(height / 2);
	expect(early.cards.map(card => card.top)).toEqual(start.cards.map(card => card.top));

	const middle = frame(824 * 20 + 150);
	const later = frame(824 * 21 + 400);
	expect(middle.center).toBeCloseTo(height / 2);
	expect(later.center).toBeCloseTo(height / 2);
	expect(later.cards[21].top).toBeLessThan(middle.cards[21].top);

	const ending = frame(824 * 46);
	const end = frame(824 * 47);
	expect(ending.center).toBeGreaterThan(height / 2);
	expect(end.center).toBeGreaterThan(ending.center);
	expect(end.cards.map(card => card.top)).toEqual(ending.cards.map(card => card.top));
});
