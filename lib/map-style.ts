import { withBasePath } from "@/lib/base-path";

/** OpenFreeMap positron. Tiles, sprites, and glyphs are absolute https URLs. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/**
 * MapLibre resolves some style, sprite, and glyph requests against the page.
 * Remote URLs stay on their own hosts. A root path such as /sprites or a
 * local image is rewritten under the Pages prefix.
 */
export function mapTransformRequest(url: string): { url: string } {
  return { url: withBasePath(url) };
}

export function mapStyleOptions() {
  return {
    style: MAP_STYLE_URL,
    transformRequest: (url: string) => mapTransformRequest(url),
  };
}
