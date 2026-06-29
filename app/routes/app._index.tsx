import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getShopLocales,
  runTranslation,
  type TranslationRunResult,
} from "../lib/shopify-translate.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const locales = await getShopLocales(admin);
  return { locales };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const targetLocale = String(formData.get("targetLocale") ?? "");
  if (!targetLocale) {
    return { error: "Pick a target language first." } as const;
  }
  const result = await runTranslation(admin, { targetLocale });
  return { result } as const;
};

type ActionData =
  | { result: TranslationRunResult; error?: undefined }
  | { error: string; result?: undefined };

export default function Index() {
  const { locales } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const fetcher = useFetcher<ActionData>();
  const shopify = useAppBridge();

  const primary = locales.find((l) => l.primary);
  const targetable = locales.filter((l) => l.published && !l.primary);

  const [targetLocale, setTargetLocale] = useState<string>(
    targetable[0]?.locale ?? "",
  );

  const isRunning =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const result = fetcher.data?.result;
  const error = fetcher.data?.error;

  useEffect(() => {
    if (result) {
      shopify.toast.show(
        `Translated ${result.totalFieldsTranslated} fields in ${(result.durationMs / 1000).toFixed(1)}s`,
      );
    }
  }, [result, shopify]);

  const run = () => {
    if (!targetLocale) return;
    const fd = new FormData();
    fd.set("targetLocale", targetLocale);
    fetcher.submit(fd, { method: "POST" });
  };

  return (
    <s-page heading="Translation autopilot">
      <s-button
        slot="primary-action"
        onClick={run}
        {...(isRunning ? { loading: true } : {})}
        {...(!targetLocale ? { disabled: true } : {})}
      >
        Translate everything
      </s-button>

      <s-section heading="1. Pick a target language">
        {targetable.length === 0 ? (
          <s-paragraph>
            No additional published languages found. Open{" "}
            <s-link href="shopify://admin/settings/languages" target="_top">
              Settings → Languages
            </s-link>
            , add and publish a language, then reload this page.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Source language:{" "}
              <strong>
                {primary ? `${primary.name} (${primary.locale})` : "—"}
              </strong>
            </s-paragraph>
            <s-select
              label="Target language"
              value={targetLocale}
              onChange={(e) => {
                setTargetLocale((e.target as HTMLSelectElement).value);
              }}
            >
              {targetable.map((l) => (
                <s-option key={l.locale} value={l.locale}>
                  {l.name} ({l.locale})
                </s-option>
              ))}
            </s-select>
          </s-stack>
        )}
      </s-section>

      <s-section heading="2. What we translate">
        <s-paragraph>
          One click translates a representative slice of:
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Products (title, description, options)</s-list-item>
          <s-list-item>Collections (title, description)</s-list-item>
          <s-list-item>Pages &amp; blog articles</s-list-item>
          <s-list-item>
            <strong>Metafields &amp; metaobjects</strong> — most apps skip these
          </s-list-item>
          <s-list-item>
            Shop policies, email templates, theme strings
          </s-list-item>
        </s-unordered-list>
        <s-paragraph>
          Translations run through MyMemory (free, no API key). For higher
          quality, set <strong>DEEPL_API_KEY</strong> in{" "}
          <s-text>.env</s-text>.
        </s-paragraph>
      </s-section>

      {error && <s-banner tone="critical">{error}</s-banner>}

      {result && (
        <s-section
          heading={`3. Results — ${result.totalFieldsTranslated} fields translated`}
        >
          <s-paragraph>
            Source <strong>{result.sourceLocale}</strong> → target{" "}
            <strong>{result.targetLocale}</strong> in{" "}
            {(result.durationMs / 1000).toFixed(1)}s.
          </s-paragraph>

          <s-table>
            <s-table-header-row>
              <s-table-header>Resource type</s-table-header>
              <s-table-header>Scanned</s-table-header>
              <s-table-header>Translated</s-table-header>
              <s-table-header>Skipped</s-table-header>
              <s-table-header>Errors</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {result.perType.map((r) => (
                <s-table-row key={r.resourceType}>
                  <s-table-cell>{r.resourceType}</s-table-cell>
                  <s-table-cell>{r.resourcesScanned}</s-table-cell>
                  <s-table-cell>{r.fieldsTranslated}</s-table-cell>
                  <s-table-cell>{r.fieldsSkipped}</s-table-cell>
                  <s-table-cell>{r.errors.length}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>

          {result.perType.some((r) => r.samples.length > 0) && (
            <s-section heading="Sample translations">
              <s-stack direction="block" gap="base">
                {result.perType.flatMap((r) =>
                  r.samples.map((s, i) => (
                    <s-box
                      key={`${r.resourceType}-${i}`}
                      padding="base"
                      borderWidth="base"
                      borderRadius="base"
                      background="subdued"
                    >
                      <s-paragraph>
                        <strong>
                          {r.resourceType} · {s.key}
                        </strong>
                      </s-paragraph>
                      <s-paragraph>
                        <s-text tone="neutral">
                          {result.sourceLocale.toUpperCase()}:
                        </s-text>{" "}
                        {s.original}
                      </s-paragraph>
                      <s-paragraph>
                        <s-text tone="neutral">
                          {result.targetLocale.toUpperCase()}:
                        </s-text>{" "}
                        {s.translated}
                      </s-paragraph>
                    </s-box>
                  )),
                )}
              </s-stack>
            </s-section>
          )}
        </s-section>
      )}

      <s-section slot="aside" heading="How this works">
        <s-paragraph>
          Reads{" "}
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableResources"
            target="_blank"
          >
            translatableResources
          </s-link>{" "}
          for each resource type, machine-translates each field, then writes
          back via{" "}
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister"
            target="_blank"
          >
            translationsRegister
          </s-link>
          .
        </s-paragraph>
        <s-paragraph>
          To verify, open the storefront and switch the language with the header
          switcher.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Cost">
        <s-paragraph>
          <strong>Free.</strong> MyMemory: 5,000 words/day anonymous, 50,000
          with email. Set MYMEMORY_EMAIL in .env to raise the cap.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
