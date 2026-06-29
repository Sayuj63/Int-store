/**
 * Free machine-translation provider.
 *
 * Primary: MyMemory (no API key, 5K words/day anonymous, 50K with email).
 * Optional: DeepL — set DEEPL_API_KEY in .env to use the (free) DeepL API.
 *
 * Both APIs work with plain text. Shopify keeps HTML in some fields
 * (rich text descriptions), so we pass HTML-safe strings through MyMemory by
 * URL-encoding; DeepL has a tag-handling flag we set.
 */

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const DEEPL_ENDPOINT = "https://api-free.deepl.com/v2/translate";

const CONCURRENCY = 5;

export type TranslateArgs = {
  text: string;
  sourceLocale: string;
  targetLocale: string;
};

async function translateWithMyMemory({
  text,
  sourceLocale,
  targetLocale,
}: TranslateArgs): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLocale}|${targetLocale}`,
    de: process.env.MYMEMORY_EMAIL ?? "intl-app@example.com",
  });
  const res = await fetch(`${MYMEMORY_ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const json = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };
  const translated = json.responseData?.translatedText;
  if (!translated) throw new Error("MyMemory returned no translation");
  return translated;
}

async function translateWithDeepL({
  text,
  sourceLocale,
  targetLocale,
}: TranslateArgs): Promise<string> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("DEEPL_API_KEY missing");
  const res = await fetch(DEEPL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      text,
      source_lang: sourceLocale.toUpperCase(),
      target_lang: targetLocale.toUpperCase(),
      tag_handling: "html",
    }),
  });
  if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
  const json = (await res.json()) as {
    translations?: { text: string }[];
  };
  const translated = json.translations?.[0]?.text;
  if (!translated) throw new Error("DeepL returned no translation");
  return translated;
}

export async function translateOne(args: TranslateArgs): Promise<string> {
  if (!args.text || !args.text.trim()) return args.text;
  if (process.env.DEEPL_API_KEY) {
    try {
      return await translateWithDeepL(args);
    } catch {
      // fall through to MyMemory
    }
  }
  return translateWithMyMemory(args);
}

/**
 * Translate many strings while respecting a small concurrency limit so we
 * don't get rate-limited by the free APIs.
 */
export async function translateMany(
  items: TranslateArgs[],
): Promise<{ translated: string; error?: string }[]> {
  const out: { translated: string; error?: string }[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        out[i] = { translated: await translateOne(items[i]) };
      } catch (err) {
        out[i] = {
          translated: items[i].text,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker),
  );
  return out;
}
