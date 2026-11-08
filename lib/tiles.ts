/**
 * Basemap tiles. Set NEXT_PUBLIC_MAP_TILES to any {z}/{x}/{y} template that
 * includes its own key (MapTiler, Stadia, whatever); without it we fall back to
 * the public OpenStreetMap raster tiles.
 */
const TEMPLATE =
  process.env.NEXT_PUBLIC_MAP_TILES ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_URL = TEMPLATE;
export const TILE_ATTRIBUTION = TEMPLATE.includes("maptiler")
  ? '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export const TILE_MAX_ZOOM = 19;
