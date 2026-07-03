// Path-based booking page. The external booking UI lives in the (booking) route
// group (served at the top-level /{slug} for wildcard-subdomain hosting). This
// route exposes the same page at the documented path-based fallback /book/{slug}
// — the URL the booking panel and settings tab copy. The component reads its
// slug from useParams, so it works identically under either route.
export { default } from '../../(booking)/[slug]/page'
