/**
 * Normalises a pasted Loom / YouTube URL into an embeddable iframe src.
 * Falls back to a plain link for anything we don't recognise. Pure + isomorphic.
 */

export type VideoEmbed =
  | { kind: "iframe"; src: string }
  | { kind: "link"; href: string }
  | null;

export function buildVideoEmbed(url: string | null | undefined): VideoEmbed {
  if (!url) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}` };
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}` };
      }
      if (u.pathname.startsWith("/embed/")) {
        return { kind: "iframe", src: trimmed };
      }
    }

    // Loom
    if (host === "loom.com") {
      const m = u.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if (m) return { kind: "iframe", src: `https://www.loom.com/embed/${m[1]}` };
    }

    // Unknown provider — offer it as a link rather than a broken iframe.
    return { kind: "link", href: trimmed };
  } catch {
    return null;
  }
}
