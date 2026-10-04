import { expect, test } from "bun:test";
import { closeAfterPhotoTransition } from "../src/lib/photoTransition";

// Browser API doubles exercise the close helper, not rendered gallery behavior.
function dialogDouble() {
	const classes = new Set<string>();
	const dialog = {
		open: true,
		classList: { contains: (name: string) => classes.has(name) },
		close() { dialog.open = false; },
	};
	return { dialog: dialog as unknown as HTMLDialogElement, classes };
}

test("closing restores the gallery image before removing the dialog, after the return flight", async () => {
	const { dialog } = dialogDouble();
	const animation = Promise.withResolvers<void>();
	const flight = { getAnimations: () => [{ finished: animation.promise }] } as unknown as HTMLElement;
	let restored = false;
	const closing = closeAfterPhotoTransition(dialog, flight, () => {
		expect(dialog.open).toBe(true);
		restored = true;
	});
	await Promise.resolve();
	expect(dialog.open).toBe(true);
	expect(restored).toBe(false);
	animation.resolve();
	await closing;
	expect(dialog.open).toBe(false);
	expect(restored).toBe(true);
});

test("a cancelled close cannot close the dialog while a replacement animation is pending", async () => {
	const { dialog } = dialogDouble();
	const first = Promise.withResolvers<void>();
	const last = Promise.withResolvers<void>();
	const firstClose = closeAfterPhotoTransition(dialog, {
		getAnimations: () => [{ finished: first.promise }],
	} as unknown as HTMLElement, () => { throw new Error("Cancelled close restored the thumbnail"); });
	first.reject(new DOMException("Reversed", "AbortError"));
	const lastClose = closeAfterPhotoTransition(dialog, {
		getAnimations: () => [{ finished: last.promise }],
	} as unknown as HTMLElement, () => {});
	await firstClose;
	expect(dialog.open).toBe(true);
	last.resolve();
	await lastClose;
	expect(dialog.open).toBe(false);
});

test("close helper leaves a re-expanded dialog open when the old animation finishes", async () => {
	const { dialog, classes } = dialogDouble();
	const animation = Promise.withResolvers<void>();
	const closing = closeAfterPhotoTransition(dialog, {
		getAnimations: () => [{ finished: animation.promise }],
	} as unknown as HTMLElement, () => { throw new Error("Re-expanded dialog restored the thumbnail"); });
	animation.resolve();
	classes.add("is-open");
	await closing;
	expect(dialog.open).toBe(true);
});
