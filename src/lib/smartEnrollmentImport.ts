export type SmartBatch = {
  id: number;
  batch_code: string | null;
};

export type SmartCycle = {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  plan_type: string;
};

export function cleanImportValue(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2018\u2019\u2032\u02BC]/g, "'")
    .trim();
}

export function buildSafeCsvHeaders(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();

  return rawHeaders.map((header, index) => {
    const cleaned = cleanImportValue(header) || `Column ${index + 1}`;
    const count = seen.get(cleaned) || 0;
    seen.set(cleaned, count + 1);
    return count === 0 ? cleaned : `${cleaned} (${count + 1})`;
  });
}

export function normalizePhone(value: string | null | undefined): string {
  const cleaned = cleanImportValue(value).replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export function normalizeLookupKey(value: string): string {
  return cleanImportValue(value).toLowerCase().replace(/[^a-z0-9.]/g, "");
}

function normalizeStyleLevel(styleLevel: string): string {
  let value = cleanImportValue(styleLevel)
    .replace(/\blevel\b/gi, "")
    .replace(/\blvl\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  value = value.replace(/^kids\s+(.+)$/i, "Kids $1");
  return value.replace(/\s+/g, "");
}

export function buildBatchCodeCandidates(styleLevel: string, studioCode: string): string[] {
  const style = normalizeStyleLevel(styleLevel);
  const studio = cleanImportValue(studioCode).toUpperCase().replace(/\s+/g, "");
  if (!style || !studio) return [];

  const candidates = new Set<string>();
  candidates.add(`${style}-${studio}`);

  const kidsMatch = style.match(/^Kids(.+?)(\d+(?:\.\d+)?)$/i);
  if (kidsMatch) {
    candidates.add(`Kids${kidsMatch[1]}${kidsMatch[2]}-${studio}`);
  }

  const gridTwoMatch = style.match(/^Grid(\d+)$/i);
  if (gridTwoMatch) {
    candidates.add(`Grid${gridTwoMatch[1]}.0-${studio}`);
  }

  return [...candidates];
}

export function buildBatchCodeFromInput(styleLevel: string, studioCode: string): string {
  return buildBatchCodeCandidates(styleLevel, studioCode)[0] || `${cleanImportValue(styleLevel)}-${cleanImportValue(studioCode)}`;
}

export function findBatchForSmartEnrollment(
  batches: SmartBatch[],
  styleLevel: string,
  studioCode: string
): { batch: SmartBatch | null; triedCodes: string[] } {
  const codeToBatch = new Map<string, SmartBatch>();
  batches.forEach((batch) => {
    if (batch.batch_code) codeToBatch.set(normalizeLookupKey(batch.batch_code), batch);
  });

  const triedCodes = buildBatchCodeCandidates(styleLevel, studioCode);
  for (const code of triedCodes) {
    const batch = codeToBatch.get(normalizeLookupKey(code));
    if (batch) return { batch, triedCodes };
  }

  return { batch: null, triedCodes };
}

function cycleTokenVariants(token: string): string[] {
  const t = cleanImportValue(token);
  const variants = new Set<string>([t]);

  const spaceAsApostrophe = t.replace(/\s+/g, "'");
  variants.add(spaceAsApostrophe);

  const letterDigitApostrophe = t.replace(/([a-zA-Z])(\d)/, "$1'$2");
  variants.add(letterDigitApostrophe);

  const gridNumber = t.match(/^grid[\s']*(\d+)$/i);
  if (gridNumber) {
    variants.add(`Grid'${gridNumber[1]}.0`);
    variants.add(`Grid ${gridNumber[1]}.0`);
  }

  return [...variants].filter(Boolean);
}

function cycleMatchesVariant(cycleName: string, variant: string): boolean {
  const cycle = cleanImportValue(cycleName).toLowerCase();
  const value = cleanImportValue(variant).toLowerCase();
  return cycle === value || cycle.startsWith(`${value}'`) || cycle.startsWith(`${value} `);
}

export function matchCycleToken(token: string, allCycles: SmartCycle[], usedCycleIds = new Set<number>()): SmartCycle | null {
  const variants = cycleTokenVariants(token);

  for (const variant of variants) {
    const match = allCycles.find((cycle) =>
      cycleMatchesVariant(cycle.name, variant) && !usedCycleIds.has(cycle.id)
    );
    if (match) {
      usedCycleIds.add(match.id);
      return match;
    }
  }

  return null;
}

export function splitCycleTokens(value: string | null | undefined): string[] {
  return cleanImportValue(value)
    .split(/[,;\n|]/)
    .map((token) => cleanImportValue(token))
    .filter(Boolean);
}

export function matchSmartEnrollmentCycles(
  value: string | null | undefined,
  allCycles: SmartCycle[]
): { matchedCycles: SmartCycle[]; unmatchedTokens: string[] } {
  const usedCycleIds = new Set<number>();
  const matchedCycles: SmartCycle[] = [];
  const unmatchedTokens: string[] = [];

  for (const token of splitCycleTokens(value)) {
    const matched = matchCycleToken(token, allCycles, usedCycleIds);
    if (matched) matchedCycles.push(matched);
    else unmatchedTokens.push(token);
  }

  matchedCycles.sort((a, b) => a.start_date.localeCompare(b.start_date));
  return { matchedCycles, unmatchedTokens };
}
