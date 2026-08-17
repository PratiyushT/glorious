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
  isRingOrderAdapterReady,
  isSupplierOrderWorkerReady,
  ringBuilderConfig,
} from "../lib/config.server";
import { fixtureDiamondCount } from "../lib/diamond-fixtures.server";
import { listSettingCollections } from "../lib/setting-collections.server";
import { builderPagePath, ensureBuilderPage } from "../lib/shopify-content.server";
import {
  AUTOMATIC_ORDER_POLICY,
  DIAMOND_ORDER_TARGET,
  RING_ORDER_TARGET,
  REVIEW_ORDER_POLICY,
  normalizeSupplierOrderPolicy,
  normalizeSupplierOrderTarget,
} from "../lib/supplier-order-targets";
import {
  createFixtureSupplierOrder,
  processSupplierOrderById,
  queueSupplierOrder,
} from "../lib/supplier-order-processing.server";

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save_setup");
  const config = ringBuilderConfig();

  if (intent === "create_fixture_order") {
    if (config.providerMode !== "fixture") {
      return { saved: false, error: "Fixture orders are available only in development mode." };
    }
    const shopConfig = await prisma.shopConfiguration.findUnique({
      where: { shop: session.shop },
    });
    const order = await createFixtureSupplierOrder({
      shop: session.shop,
      orderTarget: shopConfig?.supplierOrderTarget,
      settingTitle: shopConfig?.settingCollectionTitle,
    });
    return { createdFixtureOrder: true, orderId: order.id };
  }

  if (["approve_order", "retry_order"].includes(intent)) {
    const id = String(formData.get("orderId") || "");
    try {
      await queueSupplierOrder({ id, shop: session.shop }, config);
      const order = await processSupplierOrderById({ id, shop: session.shop }, config);
      return { processedOrder: true, orderId: id, orderStatus: order?.status };
    } catch (error) {
      return { saved: false, error: String(error.message) };
    }
  }

  const collectionId = String(formData.get("settingCollectionId") || "");
  const supplierOrderTarget = normalizeSupplierOrderTarget(
    formData.get("supplierOrderTarget"),
  );
  const supplierOrderPolicy = normalizeSupplierOrderPolicy(
    formData.get("supplierOrderPolicy"),
  );
  if (supplierOrderPolicy === AUTOMATIC_ORDER_POLICY) {
    if (!isSupplierOrderWorkerReady(config)) {
      return {
        saved: false,
        error: "Configure the authenticated supplier-order worker before enabling automatic submission.",
      };
    }
    const adapterReady = supplierOrderTarget === RING_ORDER_TARGET
      ? isRingOrderAdapterReady(config)
      : isAutomaticDiamondOrderingReady(config);
    if (!adapterReady) {
      return {
        saved: false,
        error: supplierOrderTarget === RING_ORDER_TARGET
          ? "Connect the production complete-ring adapter before enabling automatic submission."
          : "Connect production Nivoda ordering before enabling automatic submission.",
      };
    }
  }
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
      supplierOrderPolicy,
    },
    update: {
      settingCollectionId: collection?.id || null,
      settingCollectionTitle: collection?.title || null,
      supplierOrderTarget,
      supplierOrderPolicy,
    },
  });

  return {
    saved: true,
    collectionTitle: collection?.title || null,
    supplierOrderTarget,
    supplierOrderPolicy,
  };
};

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const config = ringBuilderConfig();
  const [variants, orders, recentOrders, builderPageResult, shopConfig, collections] = await Promise.all([
    prisma.diamondVariant.count({ where: { shop: session.shop } }),
    prisma.nivodaOrder.groupBy({
      by: ["status"],
      where: { shop: session.shop },
      _count: { _all: true },
    }),
    prisma.nivodaOrder.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      take: 10,
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
    ringOrderAdapterReady: isRingOrderAdapterReady(config),
    workerReady: isSupplierOrderWorkerReady(config),
    destinationReady: Boolean(config.nivodaDestinationId),
    variants,
    orders,
    recentOrders: recentOrders.map((order) => {
      let snapshot = {};
      try {
        snapshot = JSON.parse(order.snapshot || "{}");
      } catch {
        snapshot = {};
      }
      return {
        id: order.id,
        reference: snapshot.shopifyOrderName || order.shopifyOrderId,
        orderTarget: order.orderTarget,
        orderPolicy: order.orderPolicy,
        status: order.status,
        settingTitle: snapshot.setting?.title || "Setting unavailable",
        diamondTitle: snapshot.diamond?.title || snapshot.diamond?.offerId || order.offerId,
        provider: order.provider,
        providerOrderId: order.providerOrderId,
        reviewReason: order.reviewReason,
        error: order.error,
        attempts: order.attempts,
        isFixture: order.isFixture,
        createdAt: order.createdAt.toISOString(),
      };
    }),
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
  const supplierOrderPolicy = normalizeSupplierOrderPolicy(
    data.shopConfig?.supplierOrderPolicy,
  );
  const completeRingTarget = supplierOrderTarget === RING_ORDER_TARGET;
  const actionRequired =
    data.orders.find((item) => item.status === "action_required")?._count?._all || 0;
  const manualReview =
    data.orders.find((item) => item.status === "manual_review")?._count?._all || 0;
  const queued =
    data.orders.find((item) => item.status === "queued")?._count?._all || 0;
  const submitted =
    data.orders.find((item) => item.status === "submitted")?._count?._all || 0;

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
              ? "Fixture supplier workflow available; no real order can be placed"
              : supplierOrderPolicy === REVIEW_ORDER_POLICY
                ? "Two-click merchant review"
                : completeRingTarget && data.ringOrderAdapterReady
                  ? "Automatic complete-ring queue"
                  : !completeRingTarget && data.automaticDiamondOrderingReady
                    ? "Automatic loose-diamond queue"
                    : "Blocked until the selected production adapter is ready"}
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
            <s-banner
              tone={data.ringOrderAdapterReady ? "success" : "warning"}
              heading={data.ringOrderAdapterReady
                ? "Complete-ring adapter ready"
                : "Complete-ring adapter not connected"}
            >
              The app preserves and submits the setting and diamond as one versioned order. It
              never sends a complete ring through Nivoda&apos;s loose-diamond mutation. Production
              requires the signed supplier-approved webhook adapter. Nivoda Connect is a separate
              Shopify integration and is not impersonated by this app.
            </s-banner>
          )}
          {!fixtureMode && supplierOrderPolicy === AUTOMATIC_ORDER_POLICY && !data.workerReady && (
            <s-banner tone="critical" heading="Order worker required">
              Automatic policy is blocked until SUPPLIER_ORDER_WORKER_SECRET and the production
              scheduler are configured.
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
            <s-banner tone="critical" heading="Action not completed">
              {actionData.error}
            </s-banner>
          )}
          <Form method="post">
            <s-stack direction="block" gap="base">
              <input type="hidden" name="intent" value="save_setup" />
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
                label="Supplier order policy"
                name="supplierOrderPolicy"
                value={supplierOrderPolicy}
              >
                <s-option value={REVIEW_ORDER_POLICY}>
                  Review before submission — recommended
                </s-option>
                <s-option value={AUTOMATIC_ORDER_POLICY}>
                  Queue automatically after Shopify payment
                </s-option>
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
                  Complete ring — approved ring-order adapter
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
          <s-paragraph>Orders queued for the worker: {queued}</s-paragraph>
          <s-paragraph>Orders requiring attention: {actionRequired}</s-paragraph>
          <s-paragraph>Orders submitted to an adapter: {submitted}</s-paragraph>
          {fixtureMode && (
            <Form method="post">
              <input type="hidden" name="intent" value="create_fixture_order" />
              <s-button type="submit" loading={navigation.state === "submitting"}>
                Create test supplier order
              </s-button>
            </Form>
          )}
          {actionData?.createdFixtureOrder && (
            <s-banner tone="success" heading="Test order created">
              Review the fixture order below, then approve it to exercise the complete adapter
              lifecycle without contacting Nivoda.
            </s-banner>
          )}
          {actionData?.processedOrder && (
            <s-banner
              tone={actionData.orderStatus === "submitted" ? "success" : "critical"}
              heading={actionData.orderStatus === "submitted"
                ? "Supplier workflow completed"
                : "Supplier workflow needs attention"}
            >
              Order status: {actionData.orderStatus}.
            </s-banner>
          )}
          {data.recentOrders.length === 0 ? (
            <s-paragraph>No supplier orders have been captured yet.</s-paragraph>
          ) : data.recentOrders.map((order) => (
            <s-section key={order.id} heading={`${order.reference} · ${order.status}`}>
              <s-stack direction="block" gap="small">
                <s-paragraph>
                  {order.orderTarget === RING_ORDER_TARGET ? "Complete ring" : "Loose diamond"}
                  {order.isFixture ? " · Test only" : ""}
                </s-paragraph>
                <s-paragraph>{order.settingTitle} + {order.diamondTitle}</s-paragraph>
                <s-paragraph>Attempts: {order.attempts}</s-paragraph>
                {order.providerOrderId && (
                  <s-paragraph>
                    Provider: {order.provider} · Reference: {order.providerOrderId}
                  </s-paragraph>
                )}
                {order.reviewReason && <s-paragraph>{order.reviewReason}</s-paragraph>}
                {order.error && (
                  <s-banner tone="critical" heading="Submission error">
                    {order.error}
                  </s-banner>
                )}
                {["manual_review", "action_required"].includes(order.status) && (
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value={order.status === "action_required" ? "retry_order" : "approve_order"}
                    />
                    <input type="hidden" name="orderId" value={order.id} />
                    <s-button type="submit" loading={navigation.state === "submitting"}>
                      {order.status === "action_required"
                        ? "Retry after supplier reconciliation"
                        : "Approve and submit"}
                    </s-button>
                  </Form>
                )}
              </s-stack>
            </s-section>
          ))}
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
            ? "Use the test supplier order to prove review, submission, and status handling."
            : completeRingTarget
              ? "Connect Nivoda Connect or an approved ring-order adapter before submitting complete rings."
              : "Keep supplier ordering disabled until Nivoda Pro is verified in production."}</s-list-item>
        </s-ordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
