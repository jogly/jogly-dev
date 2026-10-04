export async function closeAfterPhotoTransition(dialog: HTMLDialogElement, flight: HTMLElement, restoreThumbnail: () => void) {
	try {
		await Promise.all(flight.getAnimations().map((animation) => animation.finished));
	} catch {
		// Reversing a CSS transition cancels its superseded completion.
		return;
	}
	if (dialog.open && !dialog.classList.contains("is-open")) {
		// Restore the underlying image before removing the top layer, in the same frame.
		restoreThumbnail();
		dialog.close();
	}
}
