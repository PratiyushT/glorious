import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { isNivodaConfigured, ringBuilderConfig } from "../lib/config.server";
import { builderPagePath, ensureBuilderPage } from "../lib/shopify-content.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const config = ringBuilderConfig();
  const [variants, orders, builderPageResult] = await Promise.all([
    prisma.diamondVariant.count({ where: { shop: session.shop } }),
    prisma.nivodaOrder.groupBy({
      by: ["status"],
      where: { shop: session.shop },
      _count: { _all: true },
    }),
    ensureBuilderPage(admin)
      .then((page) => ({ page, error: null }))
      .catch((error) => {
        console.error("Could not ensure the /build page", error);
        return { page: null, error: error.message };
      }),
  ]);

  return {
    shop: session.shop,
    proxyPath: "/apps/veylin-ring-builder",
    builderPath: builderPagePath,
    builderPage: builderPageResult.page,
    builderPageError: builderPageResult.error,
    nivodaReady: isNivodaConfigured(config),
    orderMode: config.orderMode,
    destinationReady: Boolean(config.nivodaDestinationId),
    variants,
    orders,
  };
};

export default function Index() {
  const data = useLoaderData();
  const actionRequired =
    data.orders.find((item) => item.status === "action_required")?._count?._all || 0;
  const manualReview =
    data.orders.find((item) => item.status === "manual_review")?._count?._all || 0;

  return (
    <s-page heading="Veylin Ring Builder">
      <s-section heading="Connection">
        <s-stack direction="block" gap="base">
          <s-paragraph>Shopify store: {data.shop}</s-paragraph>
          <s-paragraph>
            Nivoda API: {data.nivodaReady ? "Connected" : "Credentials required"}
          </s-paragraph>
          <s-paragraph>Storefront proxy: {data.proxyPath}</s-paragraph>
          <s-paragraph>Storefront builder: {data.builderPath}</s-paragraph>
          {data.builderPageError ? (
            <s-banner tone="critical" heading="Builder page needs attention">
              The app could not create or repair /build. {data.builderPageError}
            </s-banner>
          ) : (
            <s-banner tone="success" heading="Builder page ready">
              /build is published with the Ring builder theme template.
            </s-banner>
          )}
          <s-paragraph>
            Ordering: {data.orderMode === "paid" ? "Automatic after payment" : "Manual review"}
          </s-paragraph>
          {data.orderMode === "paid" && !data.destinationReady && (
            <s-banner tone="critical" heading="Destination ID required">
              Automatic ordering cannot run until NIVODA_DESTINATION_ID is configured.
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Operations">
        <s-stack direction="block" gap="base">
          <s-paragraph>Temporary diamond products: {data.variants}</s-paragraph>
          <s-paragraph>Orders awaiting manual review: {manualReview}</s-paragraph>
          <s-paragraph>Orders requiring attention: {actionRequired}</s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Activation">
        <s-ordered-list>
          <s-list-item>Add the Nivoda credentials to the app host.</s-list-item>
          <s-list-item>Use /build as the customer-facing ring builder.</s-list-item>
          <s-list-item>Select the collection that contains ring settings.</s-list-item>
          <s-list-item>Keep ordering manual until Nivoda Pro is verified in production.</s-list-item>
        </s-ordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
