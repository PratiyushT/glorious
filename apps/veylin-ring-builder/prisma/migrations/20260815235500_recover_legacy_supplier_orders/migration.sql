UPDATE "NivodaOrder"
SET "status" = 'action_required',
    "error" = COALESCE(
      "error",
      'This order was in flight before the durable worker migration. Reconcile it with the supplier before retrying.'
    )
WHERE "status" = 'submitting'
  AND "providerOrderId" IS NULL;
