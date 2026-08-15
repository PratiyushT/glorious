const BUILDER_HANDLE = "build";
const BUILDER_TEMPLATE_SUFFIX = "ring-builder";
const BUILDER_NATIVE_PATH = "/pages/build";
const BUILDER_PUBLIC_PATH = "/build";

const LIST_PAGES = `#graphql
  query BuilderPages($after: String) {
    pages(first: 250, after: $after) {
      nodes {
        id
        handle
        isPublished
        templateSuffix
        title
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const CREATE_PAGE = `#graphql
  mutation CreateBuilderPage($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page {
        id
        handle
        isPublished
        templateSuffix
        title
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const UPDATE_PAGE = `#graphql
  mutation UpdateBuilderPage($id: ID!, $page: PageUpdateInput!) {
    pageUpdate(id: $id, page: $page) {
      page {
        id
        handle
        isPublished
        templateSuffix
        title
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const LIST_REDIRECTS = `#graphql
  query BuilderRedirects($after: String) {
    urlRedirects(first: 250, after: $after) {
      nodes {
        id
        path
        target
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const CREATE_REDIRECT = `#graphql
  mutation CreateBuilderRedirect($urlRedirect: UrlRedirectInput!) {
    urlRedirectCreate(urlRedirect: $urlRedirect) {
      urlRedirect {
        id
        path
        target
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const UPDATE_REDIRECT = `#graphql
  mutation UpdateBuilderRedirect($id: ID!, $urlRedirect: UrlRedirectInput!) {
    urlRedirectUpdate(id: $id, urlRedirect: $urlRedirect) {
      urlRedirect {
        id
        path
        target
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

async function graphql(admin, query, variables) {
  const response = await admin.graphql(query, { variables });
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  return payload.data;
}

function assertNoUserErrors(result) {
  if (!result?.userErrors?.length) return;
  throw new Error(result.userErrors.map((error) => error.message).join("; "));
}

async function findBuilderPage(admin) {
  let after = null;
  do {
    const data = await graphql(admin, LIST_PAGES, { after });
    const match = data.pages.nodes.find((page) => page.handle === BUILDER_HANDLE);
    if (match) return match;
    if (!data.pages.pageInfo.hasNextPage) return null;
    after = data.pages.pageInfo.endCursor;
  } while (after);
  return null;
}

async function findBuilderRedirect(admin) {
  let after = null;
  do {
    const data = await graphql(admin, LIST_REDIRECTS, { after });
    const match = data.urlRedirects.nodes.find(
      (redirect) => redirect.path === BUILDER_PUBLIC_PATH,
    );
    if (match) return match;
    if (!data.urlRedirects.pageInfo.hasNextPage) return null;
    after = data.urlRedirects.pageInfo.endCursor;
  } while (after);
  return null;
}

async function ensureBuilderRedirect(admin) {
  const existing = await findBuilderRedirect(admin);
  if (!existing) {
    const data = await graphql(admin, CREATE_REDIRECT, {
      urlRedirect: {
        path: BUILDER_PUBLIC_PATH,
        target: BUILDER_NATIVE_PATH,
      },
    });
    assertNoUserErrors(data.urlRedirectCreate);
    return data.urlRedirectCreate.urlRedirect;
  }

  if (existing.target === BUILDER_NATIVE_PATH) return existing;

  const data = await graphql(admin, UPDATE_REDIRECT, {
    id: existing.id,
    urlRedirect: {
      path: BUILDER_PUBLIC_PATH,
      target: BUILDER_NATIVE_PATH,
    },
  });
  assertNoUserErrors(data.urlRedirectUpdate);
  return data.urlRedirectUpdate.urlRedirect;
}

export async function ensureBuilderPage(admin) {
  const existing = await findBuilderPage(admin);
  let page;
  if (!existing) {
    const data = await graphql(admin, CREATE_PAGE, {
      page: {
        title: "Build Your Ring",
        handle: BUILDER_HANDLE,
        isPublished: true,
        templateSuffix: BUILDER_TEMPLATE_SUFFIX,
      },
    });
    assertNoUserErrors(data.pageCreate);
    page = { ...data.pageCreate.page, created: true };
  } else if (
    existing.isPublished &&
    existing.templateSuffix === BUILDER_TEMPLATE_SUFFIX
  ) {
    page = { ...existing, created: false };
  } else {
    const data = await graphql(admin, UPDATE_PAGE, {
      id: existing.id,
      page: {
        handle: BUILDER_HANDLE,
        isPublished: true,
        templateSuffix: BUILDER_TEMPLATE_SUFFIX,
      },
    });
    assertNoUserErrors(data.pageUpdate);
    page = { ...data.pageUpdate.page, created: false };
  }

  const redirect = await ensureBuilderRedirect(admin);
  return { ...page, redirect };
}

export const builderPagePath = BUILDER_PUBLIC_PATH;
