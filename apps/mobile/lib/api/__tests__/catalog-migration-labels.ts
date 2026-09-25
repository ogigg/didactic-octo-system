/**
 * Reads catalog label rows and exercise catalog keys straight from the SQL
 * migrations, so tests can check label coverage without a database.
 *
 * It understands comments, `''` escapes, dollar-quoted bodies, column order
 * and casts. It throws on statements it can't evaluate safely (deleting label
 * rows, changing their keys, inserting translated labels with SELECT), so the
 * label check fails loudly instead of passing by accident.
 */

// The app's tsconfig has no Node types (CI doesn't have the generated
// expo-env.d.ts), so type the few Node built-ins this file reads by hand.
declare const __dirname: string;
interface NodeFs {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: "utf8"): string;
}
interface NodePath {
  join(...parts: string[]): string;
}
const fs = jest.requireActual<NodeFs>("fs");
const path = jest.requireActual<NodePath>("path");

const MIGRATIONS_DIR = path.join(
  __dirname,
  "../../../../../supabase/migrations"
);
const LABEL_TABLE = "catalog_label_translations";
const LABEL_KEY_COLUMNS = ["label_type", "label_key", "language_code"];
const EXERCISE_KEY_COLUMNS = [
  ["primary_muscles", "muscle"],
  ["secondary_muscles", "muscle"],
  ["equipment", "equipment"],
] as const;

export type CatalogLabelType = "muscle" | "equipment";

export interface MigrationCatalog {
  labels: Set<string>;
  /** Keys used by exercises that migrations insert with `VALUES`. */
  exerciseKeys: Record<CatalogLabelType, Set<string>>;
}

interface SqlToken {
  kind: "string" | "word" | "symbol" | "body";
  value: string;
}

interface InsertRows {
  readable: boolean;
  rows: Map<string, SqlToken[]>[];
}

function labelId(labelType: string, labelKey: string, language: string) {
  return JSON.stringify([labelType, labelKey, language]);
}

export function hasCatalogLabel(
  catalog: MigrationCatalog,
  labelType: CatalogLabelType,
  labelKey: string,
  language: string
): boolean {
  return catalog.labels.has(labelId(labelType, labelKey, language));
}

/** Splits SQL into statements of tokens, dropping comments. */
function tokenize(sql: string): SqlToken[][] {
  const statements: SqlToken[][] = [];
  let tokens: SqlToken[] = [];
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];
    const dollarTag = char === "$" ? /^\$\w*\$/.exec(sql.slice(i)) : null;

    if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
    } else if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else if (char === "'") {
      let value = "";
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          value += "'";
          i += 2;
        } else if (sql[i] === "'") {
          i += 1;
          break;
        } else {
          value += sql[i];
          i += 1;
        }
      }
      tokens.push({ kind: "string", value });
    } else if (dollarTag) {
      const tag = dollarTag[0];
      const start = i + tag.length;
      const end = sql.indexOf(tag, start);
      tokens.push({
        kind: "body",
        value: sql.slice(start, end === -1 ? sql.length : end),
      });
      i = end === -1 ? sql.length : end + tag.length;
    } else if (char === '"') {
      const end = sql.indexOf('"', i + 1);
      tokens.push({
        kind: "word",
        value: sql.slice(i + 1, end === -1 ? sql.length : end),
      });
      i = end === -1 ? sql.length : end + 1;
    } else if (char === ";") {
      if (tokens.length > 0) statements.push(tokens);
      tokens = [];
      i += 1;
    } else if (/\s/.test(char)) {
      i += 1;
    } else if (/[\w.]/.test(char)) {
      let end = i;
      while (end < sql.length && /[\w.]/.test(sql[end])) end += 1;
      tokens.push({ kind: "word", value: sql.slice(i, end) });
      i = end;
    } else if (char === ":" && next === ":") {
      tokens.push({ kind: "symbol", value: "::" });
      i += 2;
    } else {
      tokens.push({ kind: "symbol", value: char });
      i += 1;
    }
  }

  if (tokens.length > 0) statements.push(tokens);
  return statements;
}

function isWord(token: SqlToken | undefined, word: string): boolean {
  return token?.kind === "word" && token.value.toLowerCase() === word;
}

function isSymbol(token: SqlToken | undefined, symbol: string): boolean {
  return token?.kind === "symbol" && token.value === symbol;
}

function isTable(token: SqlToken | undefined, table: string): boolean {
  return (
    token?.kind === "word" &&
    token.value.toLowerCase().replace(/^public\./, "") === table
  );
}

/** Index right after `...words table`, or -1 when the statement has none. */
function findClause(tokens: SqlToken[], words: string[], table: string) {
  for (let i = 0; i + words.length < tokens.length; i += 1) {
    if (
      words.every((word, offset) => isWord(tokens[i + offset], word)) &&
      isTable(tokens[i + words.length], table)
    ) {
      return i + words.length + 1;
    }
  }
  return -1;
}

/** Comma-separated items of the parenthesized list starting at `start`. */
function readList(tokens: SqlToken[], start: number) {
  if (!isSymbol(tokens[start], "(")) return null;

  const items: SqlToken[][] = [[]];
  let depth = 0;
  for (let i = start + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (isSymbol(token, "(") || isSymbol(token, "[")) {
      depth += 1;
    } else if (isSymbol(token, ")") || isSymbol(token, "]")) {
      if (depth === 0) return { items, end: i + 1 };
      depth -= 1;
    } else if (depth === 0 && isSymbol(token, ",")) {
      items.push([]);
      continue;
    }
    items[items.length - 1].push(token);
  }
  return null;
}

function readInsertRows(tokens: SqlToken[], table: string): InsertRows | null {
  let i = findClause(tokens, ["insert", "into"], table);
  if (i === -1) return null;
  if (isWord(tokens[i], "as")) i += 2;

  const columns = readList(tokens, i);
  if (!columns || !isWord(tokens[columns.end], "values")) {
    return { readable: false, rows: [] };
  }

  const names = columns.items.map((item) => item[0]?.value.toLowerCase());
  const rows: Map<string, SqlToken[]>[] = [];
  let cursor = columns.end + 1;
  for (;;) {
    const tuple = readList(tokens, cursor);
    if (!tuple) break;
    rows.push(
      new Map(names.map((name, index) => [name, tuple.items[index] ?? []]))
    );
    if (!isSymbol(tokens[tuple.end], ",")) break;
    cursor = tuple.end + 1;
  }
  return { readable: rows.length > 0, rows };
}

/** Columns assigned by `UPDATE table ... SET a = ..., b = ...`. */
function readUpdatedColumns(tokens: SqlToken[], table: string) {
  let i = findClause(tokens, ["update"], table);
  if (i === -1) return null;
  while (i < tokens.length && !isWord(tokens[i], "set")) i += 1;

  const columns: string[] = [];
  let depth = 0;
  for (let j = i + 1; j < tokens.length; j += 1) {
    const token = tokens[j];
    if (isSymbol(token, "(")) depth += 1;
    else if (isSymbol(token, ")")) depth -= 1;
    else if (
      depth === 0 &&
      ["from", "where", "returning"].some((word) => isWord(token, word))
    ) {
      break;
    } else if (
      depth === 0 &&
      token.kind === "word" &&
      isSymbol(tokens[j + 1], "=") &&
      (j === i + 1 || isSymbol(tokens[j - 1], ","))
    ) {
      columns.push(token.value.toLowerCase().split(".").pop() ?? "");
    }
  }
  return columns;
}

/** A string literal, optionally cast (`'pl'::text`). */
function readString(value: SqlToken[]): string | null {
  const [first, ...rest] = value;
  if (first?.kind !== "string") return null;
  if (rest.length === 0 || (rest.length === 2 && isSymbol(rest[0], "::"))) {
    return first.value;
  }
  return null;
}

/** Items of `ARRAY['a', 'b']`, `'{a,b}'` or `NULL`. */
function readStringArray(value: SqlToken[]): string[] | null {
  if (value.length === 1 && isWord(value[0], "null")) return [];

  if (isWord(value[0], "array") && isSymbol(value[1], "[")) {
    const close = value.findIndex((token) => isSymbol(token, "]"));
    const inner = value.slice(2, close);
    if (
      close === -1 ||
      inner.some((token) => token.kind !== "string" && !isSymbol(token, ","))
    ) {
      return null;
    }
    return inner
      .filter((token) => token.kind === "string")
      .map((token) => token.value);
  }

  const literal = readString(value);
  if (literal?.startsWith("{") && literal.endsWith("}")) {
    return literal
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  return null;
}

function describeStatement(tokens: SqlToken[]) {
  return tokens
    .slice(0, 8)
    .map((token) => token.value)
    .join(" ");
}

function readStatement(
  tokens: SqlToken[],
  catalog: MigrationCatalog,
  translatedLanguages: readonly string[]
) {
  const statement = describeStatement(tokens);

  if (
    findClause(tokens, ["delete", "from"], LABEL_TABLE) !== -1 ||
    findClause(tokens, ["truncate"], LABEL_TABLE) !== -1 ||
    findClause(tokens, ["truncate", "table"], LABEL_TABLE) !== -1
  ) {
    throw new Error(
      `Can't tell which catalog labels this migration removes: "${statement}". Extend catalog-migration-labels.ts before relying on the label check.`
    );
  }

  const updatedColumns = readUpdatedColumns(tokens, LABEL_TABLE);
  if (updatedColumns?.some((column) => LABEL_KEY_COLUMNS.includes(column))) {
    throw new Error(
      `Can't follow catalog label keys changed by this migration: "${statement}".`
    );
  }

  const labelInsert = readInsertRows(tokens, LABEL_TABLE);
  if (labelInsert && !labelInsert.readable) {
    const translated = tokens.some(
      (token) =>
        token.kind === "string" && translatedLanguages.includes(token.value)
    );
    if (translated) {
      throw new Error(
        `Can't read the translated catalog labels this migration inserts: "${statement}". Insert them with VALUES.`
      );
    }
  }
  for (const row of labelInsert?.rows ?? []) {
    const [labelType, labelKey, language] = LABEL_KEY_COLUMNS.map((column) =>
      readString(row.get(column) ?? [])
    );
    if (labelType == null || labelKey == null || language == null) {
      throw new Error(`Can't read a catalog label row in: "${statement}".`);
    }
    catalog.labels.add(labelId(labelType, labelKey, language));
  }

  const exerciseInsert = readInsertRows(tokens, "exercises");
  for (const row of exerciseInsert?.rows ?? []) {
    for (const [column, labelType] of EXERCISE_KEY_COLUMNS) {
      const value = row.get(column);
      if (!value) continue;
      const keys = readStringArray(value);
      if (!keys) {
        throw new Error(`Can't read exercise ${column} in: "${statement}".`);
      }
      keys.forEach((key) => catalog.exerciseKeys[labelType].add(key));
    }
  }
}

export function parseMigrationCatalog(
  migrations: readonly string[],
  translatedLanguages: readonly string[]
): MigrationCatalog {
  const catalog: MigrationCatalog = {
    labels: new Set(),
    exerciseKeys: { muscle: new Set(), equipment: new Set() },
  };

  const visit = (statements: SqlToken[][]) => {
    for (const tokens of statements) {
      // DO blocks run at migration time; function bodies only when called.
      if (isWord(tokens[0], "do")) {
        tokens
          .filter((token) => token.kind === "body")
          .forEach((token) => visit(tokenize(token.value)));
      } else {
        readStatement(tokens, catalog, translatedLanguages);
      }
    }
  };
  migrations.forEach((sql) => visit(tokenize(sql)));

  return catalog;
}

export function readMigrationCatalog(
  translatedLanguages: readonly string[]
): MigrationCatalog {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  return parseMigrationCatalog(
    files.map((file) =>
      fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
    ),
    translatedLanguages
  );
}
