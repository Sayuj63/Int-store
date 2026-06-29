/**
 * Shopify translation orchestrator.
 *
 * For each requested resource type we:
 *   1. Page through `translatableResources` to collect content + digests.
 *   2. Filter to text-like content (STRING, HTML, RICH_TEXT_FIELD, INLINE_RICH_TEXT, JSON_STRING).
 *   3. Machine-translate each value via the free translator.
 *   4. Submit via `translationsRegister(resourceId, translations[])`.
 *
 * Resource types we cover for the demo:
 *   PRODUCT, COLLECTION, PAGE, ARTICLE, BLOG, SHOP, SHOP_POLICY,
 *   METAFIELD, METAOBJECT, ONLINE_STORE_THEME_LOCALE_CONTENT, EMAIL_TEMPLATE.
 *
 * Metafields + metaobjects are the wedge (no competitor covers them well).
 */

import { translateMany } from "./translator.server";

type AdminGraphqlClient = {
  graphql: (query: string, opts?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export type ResourceType =
  | "PRODUCT"
  | "COLLECTION"
  | "PAGE"
  | "ARTICLE"
  | "BLOG"
  | "SHOP"
  | "SHOP_POLICY"
  | "METAFIELD"
  | "METAOBJECT"
  | "ONLINE_STORE_THEME_LOCALE_CONTENT"
  | "EMAIL_TEMPLATE";

const DEFAULT_LIMITS: Record<ResourceType, number> = {
  PRODUCT: 10,
  COLLECTION: 5,
  PAGE: 5,
  ARTICLE: 5,
  BLOG: 5,
  SHOP: 1,
  SHOP_POLICY: 5,
  METAFIELD: 20,
  METAOBJECT: 10,
  ONLINE_STORE_THEME_LOCALE_CONTENT: 1,
  EMAIL_TEMPLATE: 5,
};

const TRANSLATABLE_TYPES = new Set([
  "STRING",
  "HTML",
  "RICH_TEXT_FIELD",
  "INLINE_RICH_TEXT",
  "JSON_STRING",
]);

const SKIP_KEYS_CONTAINING = ["handle", "url", "image", "slug"];

type TranslatableContent = {
  key: string;
  value: string | null;
  digest: string | null;
  locale: string;
  type: string;
};

type TranslatableResource = {
  resourceId: string;
  translatableContent: TranslatableContent[];
};

type ResourceResult = {
  resourceType: ResourceType;
  resourcesScanned: number;
  fieldsTranslated: number;
  fieldsSkipped: number;
  errors: string[];
  samples: { resourceId: string; key: string; original: string; translated: string }[];
};

export type TranslationRunResult = {
  targetLocale: string;
  sourceLocale: string;
  perType: ResourceResult[];
  totalFieldsTranslated: number;
  durationMs: number;
};

const TRANSLATABLE_RESOURCES_QUERY = `#graphql
  query TranslatableResources($resourceType: TranslatableResourceType!, $first: Int!, $after: String) {
    translatableResources(resourceType: $resourceType, first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        resourceId
        translatableContent {
          key
          value
          digest
          locale
          type
        }
      }
    }
  }
`;

const TRANSLATIONS_REGISTER_MUTATION = `#graphql
  mutation TranslationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
    translationsRegister(resourceId: $resourceId, translations: $translations) {
      userErrors { field message }
      translations { key value locale }
    }
  }
`;

const SHOP_LOCALES_QUERY = `#graphql
  query ShopLocales {
    shopLocales { locale primary published name }
  }
`;

export async function getShopLocales(admin: AdminGraphqlClient) {
  const res = await admin.graphql(SHOP_LOCALES_QUERY);
  const json = (await res.json()) as {
    data?: { shopLocales: { locale: string; primary: boolean; published: boolean; name: string }[] };
  };
  return json.data?.shopLocales ?? [];
}

async function fetchTranslatableResources(
  admin: AdminGraphqlClient,
  resourceType: ResourceType,
  limit: number,
): Promise<TranslatableResource[]> {
  const collected: TranslatableResource[] = [];
  let after: string | null = null;
  const pageSize = Math.min(limit, 50);

  while (collected.length < limit) {
    const res = await admin.graphql(TRANSLATABLE_RESOURCES_QUERY, {
      variables: { resourceType, first: pageSize, after },
    });
    const json = (await res.json()) as {
      data?: {
        translatableResources?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: TranslatableResource[];
        };
      };
      errors?: unknown;
    };
    const conn = json.data?.translatableResources;
    if (!conn) break;
    collected.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return collected.slice(0, limit);
}

function shouldTranslate(c: TranslatableContent): boolean {
  if (!c.value || !c.value.trim()) return false;
  if (!TRANSLATABLE_TYPES.has(c.type)) return false;
  const lower = c.key.toLowerCase();
  if (SKIP_KEYS_CONTAINING.some((s) => lower.includes(s))) return false;
  return true;
}

async function registerTranslations(
  admin: AdminGraphqlClient,
  resourceId: string,
  translations: { locale: string; key: string; value: string; translatableContentDigest: string }[],
) {
  if (translations.length === 0) return { userErrors: [] as { message: string }[] };
  const res = await admin.graphql(TRANSLATIONS_REGISTER_MUTATION, {
    variables: { resourceId, translations },
  });
  const json = (await res.json()) as {
    data?: { translationsRegister?: { userErrors: { message: string }[] } };
  };
  return json.data?.translationsRegister ?? { userErrors: [] };
}

async function runForResourceType(
  admin: AdminGraphqlClient,
  resourceType: ResourceType,
  sourceLocale: string,
  targetLocale: string,
  limit: number,
): Promise<ResourceResult> {
  const result: ResourceResult = {
    resourceType,
    resourcesScanned: 0,
    fieldsTranslated: 0,
    fieldsSkipped: 0,
    errors: [],
    samples: [],
  };

  let resources: TranslatableResource[] = [];
  try {
    resources = await fetchTranslatableResources(admin, resourceType, limit);
  } catch (err) {
    result.errors.push(
      `fetch ${resourceType}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }
  result.resourcesScanned = resources.length;

  for (const resource of resources) {
    const toTranslate = resource.translatableContent.filter(shouldTranslate);
    result.fieldsSkipped += resource.translatableContent.length - toTranslate.length;
    if (toTranslate.length === 0) continue;

    const translated = await translateMany(
      toTranslate.map((c) => ({
        text: c.value!,
        sourceLocale,
        targetLocale,
      })),
    );

    const payload = toTranslate
      .map((c, i) => {
        const t = translated[i];
        if (!t || t.error || !c.digest) return null;
        return {
          locale: targetLocale,
          key: c.key,
          value: t.translated,
          translatableContentDigest: c.digest,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    try {
      const reg = await registerTranslations(admin, resource.resourceId, payload);
      if (reg.userErrors.length) {
        result.errors.push(`${resource.resourceId}: ${reg.userErrors.map((e) => e.message).join("; ")}`);
      } else {
        result.fieldsTranslated += payload.length;
        if (result.samples.length < 3 && payload[0]) {
          result.samples.push({
            resourceId: resource.resourceId,
            key: payload[0].key,
            original: toTranslate[0].value!,
            translated: payload[0].value,
          });
        }
      }
    } catch (err) {
      result.errors.push(
        `register ${resource.resourceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

export async function runTranslation(
  admin: AdminGraphqlClient,
  opts: {
    targetLocale: string;
    sourceLocale?: string;
    resourceTypes?: ResourceType[];
    limits?: Partial<Record<ResourceType, number>>;
  },
): Promise<TranslationRunResult> {
  const started = Date.now();
  const locales = await getShopLocales(admin);
  const primary = locales.find((l) => l.primary);
  const sourceLocale = opts.sourceLocale ?? primary?.locale ?? "en";

  const types: ResourceType[] = opts.resourceTypes ?? [
    "PRODUCT",
    "COLLECTION",
    "PAGE",
    "ARTICLE",
    "BLOG",
    "SHOP",
    "SHOP_POLICY",
    "METAFIELD",
    "METAOBJECT",
    "ONLINE_STORE_THEME_LOCALE_CONTENT",
    "EMAIL_TEMPLATE",
  ];

  const perType: ResourceResult[] = [];
  for (const rt of types) {
    const limit = opts.limits?.[rt] ?? DEFAULT_LIMITS[rt];
    perType.push(
      await runForResourceType(admin, rt, sourceLocale, opts.targetLocale, limit),
    );
  }

  return {
    targetLocale: opts.targetLocale,
    sourceLocale,
    perType,
    totalFieldsTranslated: perType.reduce((s, r) => s + r.fieldsTranslated, 0),
    durationMs: Date.now() - started,
  };
}
