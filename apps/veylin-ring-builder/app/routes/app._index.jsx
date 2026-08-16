import process from "node:process";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  isAutomaticDiamondOrderingReady,
  isDiamondProviderReady,
  ringBuilderConfig,
} from "../lib/config.server";
import { fixtureDiamondCount } from "../lib/diamond-fixtures.server";
import { listSettingCollections } from "../lib/setting-collections.server";
import { builderPagePath, ensureBuilderPage } from "../lib/shopify-content.server";
import {
  DIAMOND_ORDER_TARGET,
  RING_ORDER_TARGET,
  normalizeSupplierOrderTarget,
} from "../lib/supplier-order-targets";

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const collectionId = String(formData.get("settingCollectionId") || "");
  const supplierOrderTarget = normalizeSupplierOrderTarget(
    formData.get("supplierOrderTarget"),
  );
  const collections = await listSettingCollections(admin);
  const collection = collections.find((item) => item.id === collectionId) || null;

  if (collectionId && !collection) {
    return { saved: false, error: "Choose a collection from this Shopify store." };
  }

  await prisma.shopConfiguration.upsert({
    where: { shop: session.shop },
    create: {
      shop: session.shop,
      settingCollectionId: collection?.id || null,
      settingCollectionTitle: collection?.title || null,
      supplierOrderTarget,
    },
    update: {
      settingCollectionId: collection?.id || null,
      settingCollectionTitle: collection?.title || null,
      supplierOrderTarget,
    },
  });

  return {
    saved: true,
    collectionTitle: collection?.title || null,
    supplierOrderTarget,
  };
};

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const config = ringBuilderConfig();
  const [variants, orders, builderPageResult, shopConfig, collections] = await Promise.all([
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
    prisma.shopConfiguration.findUnique({ where: { shop: session.shop } }),
    listSettingCollections(admin),
  ]);

  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const activationUrl = `https://${session.shop}/admin/themes/current/editor?template=page.ring-builder&addAppBlockId=${apiKey}/ring-builder&target=mainSection`;

  return {
    shop: session.shop,
    proxyPath: "/apps/veylin-ring-builder",
    builderPath: builderPagePath,
    builderPage: builderPageResult.page,
    builderPageError: builderPageResult.error,
    providerMode: config.providerMode,
    providerEnvironment: config.providerEnvironment,
    providerReady: isDiamondProviderReady(config),
    fixtureDiamondCount,
    orderMode: config.orderMode,
    automaticDiamondOrderingReady: isAutomaticDiamondOrderingReady(config),
    destinationReady: Boolean(config.nivodaDestinationId),
    variants,
    orders,
    shopConfig,
    collections,
    activationUrl,
  };
};

export default function Index() {
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const fixtureMode = data.providerMode === "fixture";
  const supplierOrderTarget = normalizeSupplierOrderTarget(
    data.shopConfig?.supplierOrderTarget,
  );
  const completeRingTarget = supplierOrderTarget === RING_ORDER_TARGET;
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
            Diamond catalog: {fixtureMode
              ? `Staging fixtures (${data.fixtureDiamondCount} diamonds)`
              : data.providerReady
                ? data.providerEnvironment === "staging" ? "Nivoda staging connected" : "Nivoda connected"
                : "Nivoda credentials required"}
          </s-paragraph>
          {fixtureMode && (
            <s-banner tone="warning" heading="Fixture catalog active">
              These are test diamonds. Supplier ordering is forced off and test cart lines are not submitted to Nivoda.
            </s-banner>
          )}
          <s-paragraph>Storefront proxy: {data.proxyPath}</s-paragraph>
          <s-paragraph>Storefront builder: {data.builderPath}</s-paragraph>
          {data.builderPageError ? (
            <s-banner tone="critical" heading="Builder page needs attention">
              The app could not create or repair /build. {data.builderPageError}
            </s-banner>
          ) : (
            <s-banner tone="success" heading="Builder page ready">
              /build is published as the storefront shell for the app integration.
            </s-banner>
          )}
          <s-paragraph>
            Ordering: {fixtureMode
              ? "Disabled in development"
              : completeRingTarget
                ? "Complete-ring review and approved integration handoff"
                : data.automaticDiamondOrderingReady
                ? "Automatic after payment"
                : data.orderMode === "paid"
                  ? "Blocked until every production ordering gate is ready"
                : "Disabled; paid orders require manual supplier review"}
          </s-paragraph>
          {data.orderMode === "paid" && !completeRingTarget && !data.destinationReady && (
            <s-banner tone="critical" heading="Destination ID required">
              Automatic ordering cannot run until NIVODA_DESTINATION_ID is configured.
            </s-banner>
          )}
          {data.orderMode === "paid" && !completeRingTarget
            && data.destinationReady && !data.automaticDiamondOrderingReady && (
            <s-banner tone="critical" heading="Production connection required">
              Paid-order submission remains blocked until production Nivoda credentials and the
              production endpoint are active.
            </s-banner>
          )}
          {completeRingTarget && (
            <s-banner tone="info" heading="Complete-ring routing selected">
              The app preserves the full setting and diamond bundle for fulfilment. It never sends
              this target through Nivoda&apos;s loose-diamond order mutation; production submission
              requires Nivoda Connect or a Nivoda-approved ring-order adapter.
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Storefront setup">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            The app owns the builder. The theme supplies only the /build page shell.
          </s-paragraph>
          {actionData?.saved && (
            <s-banner tone="success" heading="Builder setup saved">
              {actionData.collectionTitle
                ? `${actionData.collectionTitle} is now used by the storefront app.`
                : "The setting collection was cleared."}
            </s-banner>
          )}
          {actionData?.error && (
            <s-banner tone="critical" heading="Collection not saved">
              {actionData.error}
            </s-banner>
          )}
          <Form method="post">
            <s-stack direction="block" gap="base">
              <s-select
                label="Ring setting collection"
                name="settingCollectionId"
                value={data.shopConfig?.settingCollectionId || ""}
              >
                <s-option value="">Select a collection</s-option>
                {data.collections.map((collection) => (
                  <s-option key={collection.id} value={collection.id}>
                    {collection.title}
                  </s-option>
                ))}
              </s-select>
              <s-select
                label="Supplier fulfilment target"
                name="supplierOrderTarget"
                value={supplierOrderTarget}
              >
                <s-option value={DIAMOND_ORDER_TARGET}>
                  Loose diamond only — Nivoda Pro API
                </s-option>
                <s-option value={RING_ORDER_TARGET}>
                  Complete ring — Nivoda Connect or approved ring adapter
                </s-option>
              </s-select>
              <s-button
                type="submit"
                variant="primary"
                loading={navigation.state === "submitting"}
              >
                Save builder setup
              </s-button>
            </s-stack>
          </Form>
          <s-link href={data.activationUrl} target="_top">
            Add the Ring Builder app integration to the /build shell
          </s-link>
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
          <s-list-item>{fixtureMode
            ? "Validate the complete storefront and Shopify cart flow with fixture diamonds."
            : data.providerEnvironment === "staging"
              ? "Validate search, supplier media, price revalidation, and Shopify cart with Nivoda staging."
              : data.providerReady
                ? "Confirm the production Nivoda connection."
                : "Add the Nivoda credentials to the app host."}</s-list-item>
          <s-list-item>Use /build as the customer-facing ring builder.</s-list-item>
          <s-list-item>Select the ring setting collection in this app.</s-list-item>
          <s-list-item>Add this app’s Ring Builder block to the /build shell.</s-list-item>
          <s-list-item>{fixtureMode
            ? "Supplier ordering stays disabled while fixture diamonds are active."
            : completeRingTarget
              ? "Connect Nivoda Connect or an approved ring-order adapter before submitting complete rings."
              : "Keep supplier ordering disabled until Nivoda Pro is verified in production."}</s-list-item>
        </s-ordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
