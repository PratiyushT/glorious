import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { assertAllowedShop, ringBuilderConfig } from "../lib/config.server";
import { getSettingCollection } from "../lib/setting-collections.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) {
    return Response.json({ error: "App installation required" }, { status: 401 });
  }

  const config = ringBuilderConfig();
  assertAllowedShop(session.shop, config);
  const shopConfig = await prisma.shopConfiguration.findUnique({
    where: { shop: session.shop },
  });

  if (!shopConfig?.settingCollectionId) {
    return Response.json({ collection: null, items: [] });
  }

  try {
    const collection = await getSettingCollection(
      admin,
      shopConfig.settingCollectionId,
    );
    if (!collection) {
      return Response.json(
        { error: "The configured ring setting collection is unavailable" },
        { status: 409 },
      );
    }
    return Response.json(collection, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    console.error("Ring setting collection failed", error);
    return Response.json(
      { error: "Ring settings are temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
};
