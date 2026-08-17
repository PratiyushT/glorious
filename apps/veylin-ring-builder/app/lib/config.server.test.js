import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import {
  isAutomaticDiamondOrderingReady,
  isDiamondProviderReady,
  isRingOrderAdapterReady,
  isSupplierOrderWorkerReady,
  ringBuilderConfig,
} from "./config.server.js";

test("fixture mode needs no Nivoda credentials and forces ordering off", () => {
  const original = {
    providerMode: process.env.RING_BUILDER_PROVIDER_MODE,
    orderMode: process.env.NIVODA_ORDER_MODE,
    username: process.env.NIVODA_USERNAME,
    password: process.env.NIVODA_PASSWORD,
  };

  try {
    process.env.RING_BUILDER_PROVIDER_MODE = "fixture";
    process.env.NIVODA_ORDER_MODE = "paid";
    delete process.env.NIVODA_USERNAME;
    delete process.env.NIVODA_PASSWORD;
    const config = ringBuilderConfig();

    assert.equal(config.providerMode, "fixture");
    assert.equal(config.providerEnvironment, "fixture");
    assert.equal(config.orderMode, "disabled");
    assert.equal(isDiamondProviderReady(config), true);
  } finally {
    for (const [key, value] of Object.entries({
      RING_BUILDER_PROVIDER_MODE: original.providerMode,
      NIVODA_ORDER_MODE: original.orderMode,
      NIVODA_USERNAME: original.username,
      NIVODA_PASSWORD: original.password,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Nivoda integration endpoints are identified as staging", () => {
  const original = {
    providerMode: process.env.RING_BUILDER_PROVIDER_MODE,
    apiUrl: process.env.NIVODA_API_URL,
  };

  try {
    process.env.RING_BUILDER_PROVIDER_MODE = "nivoda";
    process.env.NIVODA_API_URL = "https://intg-customer-staging.nivodaapi.net/api/diamonds";

    assert.equal(ringBuilderConfig().providerEnvironment, "staging");
  } finally {
    for (const [key, value] of Object.entries({
      RING_BUILDER_PROVIDER_MODE: original.providerMode,
      NIVODA_API_URL: original.apiUrl,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("development defaults to fixtures when Nivoda is not configured", () => {
  const original = {
    nodeEnv: process.env.NODE_ENV,
    providerMode: process.env.RING_BUILDER_PROVIDER_MODE,
    username: process.env.NIVODA_USERNAME,
    password: process.env.NIVODA_PASSWORD,
  };

  try {
    process.env.NODE_ENV = "development";
    delete process.env.RING_BUILDER_PROVIDER_MODE;
    delete process.env.NIVODA_USERNAME;
    delete process.env.NIVODA_PASSWORD;

    assert.equal(ringBuilderConfig().providerMode, "fixture");
  } finally {
    for (const [key, value] of Object.entries({
      NODE_ENV: original.nodeEnv,
      RING_BUILDER_PROVIDER_MODE: original.providerMode,
      NIVODA_USERNAME: original.username,
      NIVODA_PASSWORD: original.password,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("automatic diamond ordering is production-only", () => {
  const ready = {
    providerMode: "nivoda",
    providerEnvironment: "production",
    orderMode: "paid",
    nivodaDestinationId: "destination-1",
    nivodaUsername: "user",
    nivodaPassword: "password",
  };

  assert.equal(isAutomaticDiamondOrderingReady(ready), true);
  assert.equal(isAutomaticDiamondOrderingReady({
    ...ready,
    providerEnvironment: "staging",
  }), false);
  assert.equal(isAutomaticDiamondOrderingReady({
    ...ready,
    nivodaDestinationId: "",
  }), false);
});

test("ring-order webhooks require a production HTTPS endpoint and secret", () => {
  const ready = {
    providerMode: "nivoda",
    providerEnvironment: "production",
    ringOrderMode: "webhook",
    ringOrderUrl: "https://orders.example.com/nivoda/rings",
    ringOrderSecret: "a-secure-ring-order-secret-at-least-32",
  };

  assert.equal(isRingOrderAdapterReady(ready), true);
  assert.equal(isRingOrderAdapterReady({ ...ready, ringOrderUrl: "http://example.com" }), false);
  assert.equal(isRingOrderAdapterReady({ ...ready, providerEnvironment: "staging" }), false);
  assert.equal(isRingOrderAdapterReady({ ...ready, ringOrderSecret: "" }), false);
  assert.equal(isRingOrderAdapterReady({
    providerMode: "fixture",
    ringOrderMode: "fixture",
  }), true);
  assert.equal(isSupplierOrderWorkerReady({
    supplierOrderWorkerSecret: "a-secure-worker-secret-at-least-32-chars",
  }), true);
  assert.equal(isSupplierOrderWorkerReady({ supplierOrderWorkerSecret: "short" }), false);
});
