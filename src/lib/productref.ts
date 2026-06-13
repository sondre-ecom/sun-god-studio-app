import { db, save, Project } from "./store";
import { importUrl } from "./hf";

const PRODUCT_RX = /\b(tub|bottle|jar|scoop|sachet|stick ?pack|packet|product|label|packaging|canister|pack ?shot|container|sticker|bag)\b/i;

const MATCH_NOTE =
  "IMPORTANT: a real product reference photo is provided as an image input. The product in this shot must EXACTLY match that reference — same bottle/tub/package shape, label, logo, wordmark, text, and colors. Do NOT invent a different package or relabel it.";

/** Does this scene actually show the product? (brand name mentioned, or product-noun present) */
export function sceneFeaturesProduct(visual: string, brandName?: string): boolean {
  const v = (visual || "").toLowerCase();
  if (brandName && brandName.trim() && v.includes(brandName.trim().toLowerCase())) return true;
  return PRODUCT_RX.test(v);
}

/**
 * If the project's brand has a real product photo AND this scene shows the product, import that
 * photo into the render user's Higgsfield (cached) and return its media id + a prompt note telling
 * the model to match it exactly. Returns {} when not applicable.
 */
export async function productReference(
  project: Project,
  renderUserId: string,
  sceneVisual: string,
  origin: string
): Promise<{ mediaId?: string; matchNote?: string }> {
  if (!project.brandId) return {};
  const brand = db().brands.find((b) => b.id === project.brandId);
  if (!brand?.productImage) return {};
  if (!sceneFeaturesProduct(sceneVisual, brand.name)) return {};

  if (brand.productMediaId && brand.productMediaOwner === renderUserId) {
    return { mediaId: brand.productMediaId, matchNote: MATCH_NOTE };
  }
  try {
    const mediaId = await importUrl(renderUserId, `${origin}/api/product-image/${brand.productImage}`);
    brand.productMediaId = mediaId;
    brand.productMediaOwner = renderUserId;
    save();
    return { mediaId, matchNote: MATCH_NOTE };
  } catch {
    return {}; // import failed (e.g. local origin Higgsfield can't reach) — skip gracefully
  }
}
