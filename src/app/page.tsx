// Root page — proxy.ts handles all redirects for '/'
// This component should never render because proxy redirects first,
// but we keep it as a fallback.
export default function Home() {
  return null;
}
