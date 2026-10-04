import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { photoUrl, type GalleryPhoto } from "../lib/photoUrl";
import { photoStack, photoViewport } from "../lib/photoStack";

export function PhotoRail({ photos, streamRef, onNavigate }: {
	photos: GalleryPhoto[];
	streamRef: RefObject<HTMLOListElement | null>;
	onNavigate: (index: number) => void;
}) {
	const shellRef = useRef<HTMLDivElement>(null);
	const pointerRef = useRef({ x: -1, y: -1 });
	const [hasRoom, setHasRoom] = useState(false);
	const [hasShown, setHasShown] = useState(false);
	const [view, setView] = useState({ active: 0, position: 0, first: 0, last: 0, start: 0, end: 1 });
	const active = view.active;
	const [hovered, setHovered] = useState<number | null>(null);
	const [focused, setFocused] = useState<number | null>(null);
	const [height, setHeight] = useState(0);
	const expanded = hovered ?? focused ?? active;
	// Hover opens one sleeve in place; it must not move the next pointer target.
	const cards = photoStack(photos.length, focused ?? view.position, height);
	const markerTop = (cards[view.first]?.top ?? 0) + view.start * 56;
	const markerBottom = (cards[view.last]?.top ?? 0) + view.end * 56;

	useEffect(() => {
		const stream = streamRef.current!;
		const measure = () => {
			const margin = stream.getBoundingClientRect().left;
			shellRef.current!.style.width = `${Math.max(0, margin - 40)}px`;
			shellRef.current!.style.setProperty("--rail-start", `${stream.getBoundingClientRect().top - stream.closest(".v-cotswolds")!.getBoundingClientRect().top}px`);
			const availableHeight = Math.max(0, shellRef.current!.clientHeight - 16);
			setHeight(availableHeight);
			const fits = margin >= 112 && availableHeight >= 56;
			setHasRoom(fits);
			if (!fits) {
				setHovered(null);
				setFocused(null);
			}
			if (fits) setHasShown(true);
		};
		const resize = new ResizeObserver(measure);
		resize.observe(stream.closest(".photo-page-scroll")!);
		resize.observe(stream);
		measure();
		return () => resize.disconnect();
	}, [streamRef]);

	useEffect(() => {
		if (!hasRoom) return;
		const stream = streamRef.current!;
		const viewport = stream.closest<HTMLElement>(".photo-page-scroll")!;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const bounds = viewport.getBoundingClientRect();
			const range = photoViewport(Array.from(stream.children, (photo) => {
				const rect = photo.getBoundingClientRect();
				return { top: rect.top - bounds.top, height: rect.height };
			}), viewport.clientHeight);
			if (range) setView(range);
		};
		const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
		const resize = new ResizeObserver(schedule);
		resize.observe(viewport);
		resize.observe(stream);
		viewport.addEventListener("scroll", schedule, { passive: true });
		schedule();
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			viewport.removeEventListener("scroll", schedule);
		};
	}, [hasRoom, streamRef]);

	return <div ref={shellRef} className="photo-rail-shell">
		<nav
			className="photo-rail t-panel-slide"
			data-open={hasRoom}
			data-follow-scroll={focused === null}
			inert={!hasRoom}
			aria-hidden={!hasRoom}
			aria-label="Jump to photograph"
			onMouseDownCapture={(event) => event.stopPropagation()}
			onPointerMove={(event) => {
				if (event.pointerType === "touch") return;
				const { clientX: x, clientY: y } = event;
				if (pointerRef.current.x === x && pointerRef.current.y === y) return;
				pointerRef.current = { x, y };
				const button = (event.target as Element).closest<HTMLButtonElement>("button[data-index]");
				if (button) setHovered(Number(button.dataset.index));
			}}
			onPointerLeave={() => setHovered(null)}
		>
			<div className="photo-rail-items">
			{hasShown && <div className="photo-rail-viewport" aria-hidden="true" style={{
				transform: `translateY(${markerTop - 4}px)`, height: `${markerBottom - markerTop + 8}px`,
			}} />}
			{hasShown && photos.map((photo, index) => {
				const center = cards[index].top + 28;
				const distance = Math.max(markerTop - center, center - markerBottom, 0);
				const fade = Math.max(0, Math.min(1, (distance - 56) / 120));
				return <button
				key={photo.id}
				type="button"
				aria-label={`Go to photo ${index + 1}: ${photo.alt}`}
				aria-current={active === index ? "true" : undefined}
				data-expanded={expanded === index}
				data-flat={cards[index].flat}
				data-index={index}
				style={{
					transform: `translateY(${cards[index].top}px)`,
					zIndex: expanded === index ? photos.length + 1 : Math.round(cards[index].depth),
					"--sleeve-tilt": `${cards[index].tilt}deg`,
					"--sleeve-scale": cards[index].scale,
					"--sleeve-saturation": 1 - 0.9 * fade * fade * (3 - 2 * fade),
				} as CSSProperties}
				onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setFocused(index); }}
				onBlur={() => setFocused(null)}
				onClickCapture={(event) => {
					event.stopPropagation();
					onNavigate(index);
				}}
			>
				<span className="photo-rail-card">
					<span className="photo-rail-sleeve">
						<img src={photoUrl(photo, 480, "webp")} alt="" width={56} height={56} loading="lazy" decoding="async" draggable={false} />
					</span>
				</span>
			</button>;
			})}
			</div>
		</nav>
	</div>;
}
