import album from "../content/photos/cotswolds.json";
import { PhotoGallery } from "../components/PhotoGallery";
import "../styles/cotswolds.css";

const closingPhotoId = "ef6ef6d26d8a8faa3fab9b54f4c98aec4378642e55a94c26d73a90d0fd2bb148";
const photos = [...album.images].sort((left, right) =>
	Number(left.id === closingPhotoId) - Number(right.id === closingPhotoId)
	|| left.order - right.order,
);

export function Cotswolds() {
	return (
		<div className="photo-page-scroll" tabIndex={-1}>
			<div className="v-cotswolds">
				<a className="skip-link" href="#main">Skip to photographs</a>
				<header className="trip-top">
					<h1>{album.title}</h1>
					<a href="/">jogly.dev</a>
				</header>
				<main id="main">
					<PhotoGallery photos={photos} />
				</main>
			</div>
		</div>
	);
}
