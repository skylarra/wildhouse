// GET /api/catalog
// Returns the live Square catalog + inventory in the same shape as
// data/products.json. If Square isn't configured, responds 501 so the
// frontend falls back to the bundled products.json.
import {
  squareConfig,
  squareFetch,
  squareToCatalog,
  listCatalogObjects,
  json,
  missingSquareEnv,
} from "./_square.js";

export async function onRequestGet({ env }) {
  const cfg = squareConfig(env);
  if (!cfg.configured) {
    return json(
      {
        error: "Square not configured",
        fallback: true,
        missing: missingSquareEnv(env),
        environment: cfg.environment,
      },
      501
    );
  }

  try {
    // Paginate so CUSTOM_ATTRIBUTE_DEFINITION (Collection selections, Featured)
    // is never dropped when the catalog spans multiple List pages.
    const objects = await listCatalogObjects(cfg);

    // Look up real-time inventory for every variation.
    const variationIds = objects
      .filter((o) => o.type === "ITEM")
      .flatMap((o) => (o.item_data?.variations || []).map((v) => v.id));

    let counts = [];
    if (variationIds.length) {
      const inv = await squareFetch(cfg, "/v2/inventory/counts/batch-retrieve", {
        method: "POST",
        body: JSON.stringify({
          catalog_object_ids: variationIds,
          location_ids: [cfg.locationId],
        }),
      });
      counts = (inv.counts || [])
        .filter((c) => c.state === "IN_STOCK")
        .map((c) => ({ catalog_object_id: c.catalog_object_id, quantity: c.quantity }));
    }

    const payload = squareToCatalog(objects, counts);
    payload._meta = {
      source: "square",
      environment: cfg.environment,
      itemCount: (payload.objects || []).length,
      collectionOptionCount: (payload.collectionOptions || []).length,
    };
    return json(payload);
  } catch (err) {
    const message = String(err?.message || err);
    const locationMismatch = /location with the id/i.test(message);
    return json(
      {
        error: message,
        environment: cfg.environment,
        // Hint only — never echo the token. Location ids differ between sandbox and production.
        ...(locationMismatch
          ? {
              hint: "SQUARE_LOCATION_ID does not belong to this Square environment. In the Square Dashboard (Production mode), open Locations, copy the production Location ID, and set SQUARE_LOCATION_ID in Cloudflare Pages → Settings → Environment variables (Production).",
            }
          : {}),
      },
      502
    );
  }
}
