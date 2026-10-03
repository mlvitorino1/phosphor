import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import yauzl from "yauzl";

const roots = {
  "01": "Declaração pública",
  "02": "Apelo",
  "03": "Intenção expressa",
  "04": "Consulta",
  "05": "Cooperação diplomática",
  "06": "Cooperação material",
  "07": "Ajuda",
  "08": "Concessão",
  "09": "Investigação",
  10: "Exigência",
  11: "Desaprovação",
  12: "Rejeição",
  13: "Ameaça",
  14: "Protesto",
  15: "Redução de força",
  16: "Redução de relações",
  17: "Coerção",
  18: "Agressão",
  19: "Confronto",
  20: "Violência em massa",
};
const args = process.argv.slice(2);
const period = args.find((arg) => !arg.startsWith("--"));
const country =
  args
    .find((arg) => arg.startsWith("--country="))
    ?.slice(10)
    .toUpperCase() ?? "";
const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? "250");
const allowedPeriod =
  /^(?:19(?:7[9]|[89]\d)|200[0-5])$/.test(period ?? "") ||
  /^(?:200[6-9]|201[0-2])(?:0[1-9]|1[0-2])$/.test(period ?? "") ||
  /^20130[1-3]$/.test(period ?? "") ||
  (/^\d{8}$/.test(period ?? "") &&
    period >= "20130401" &&
    period <= new Date().toISOString().slice(0, 10).replaceAll("-", ""));
if (
  !allowedPeriod ||
  (country && !/^[A-Z]{2}$/.test(country)) ||
  !Number.isInteger(limit) ||
  limit < 1 ||
  limit > 2000
) {
  console.error("Uso: npm run history:import -- 1979 [--country=BR] [--limit=250]");
  console.error("Períodos: ano 1979–2005, mês 200601–201303 ou dia YYYYMMDD desde 20130401.");
  process.exit(1);
}

const archive = `${period}${period.length === 8 ? ".export.CSV" : ""}.zip`;
const archiveUrl = `https://data.gdeltproject.org/events/${archive}`;
const targetDir = resolve("public", "history");
const tempPath = join(tmpdir(), `gem-gdelt-${process.pid}-${period}.zip`);

function parseRow(line) {
  const col = line.split("\t");
  if (col.length < 57 || col[25] !== "1") return null;
  const code = col[28],
    date = col[1];
  const lat = Number(col[53]),
    lng = Number(col[54]);
  const mentions = Number(col[31]) || 0,
    sources = Number(col[32]) || 0;
  if (
    !roots[code] ||
    !/^\d{8}$/.test(date) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    !col[50] ||
    (country && col[51] !== country)
  )
    return null;
  const day = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  if (!Number.isFinite(Date.parse(day))) return null;
  return {
    id: col[0],
    date: day,
    rootCode: code,
    type: roots[code],
    eventCode: col[26],
    actor1: col[6]?.slice(0, 120) || "",
    actor2: col[16]?.slice(0, 120) || "",
    location: col[50].slice(0, 180),
    countryCode: col[51],
    geoLevel: col[49],
    lat,
    lng,
    mentions,
    sources,
    sourceUrl: /^https?:\/\//.test(col[57] ?? "") ? col[57] : null,
  };
}

function uniqueTop(rows, count) {
  const unique = new Map();
  for (const row of rows.sort((a, b) => b.mentions - a.mentions || b.sources - a.sources)) {
    const actors = [row.actor1, row.actor2].filter(Boolean).sort().join("|");
    const key = `${row.date}|${row.eventCode}|${actors}|${row.location.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, row);
    if (unique.size >= count) break;
  }
  return [...unique.values()];
}

async function download() {
  const response = await fetch(archiveUrl, { signal: AbortSignal.timeout(120000) });
  if (!response.ok || !response.body)
    throw new Error(`Arquivo indisponível: HTTP ${response.status}`);
  const size = Number(response.headers.get("content-length"));
  if (size > 220_000_000) throw new Error("Arquivo comprimido acima do limite de 220 MB");
  let received = 0;
  const body = Readable.fromWeb(response.body);
  body.on("data", (chunk) => {
    received += chunk.length;
    if (received > 220_000_000)
      body.destroy(new Error("Arquivo comprimido acima do limite de 220 MB"));
  });
  await pipeline(body, createWriteStream(tempPath));
  return received;
}

async function readZip() {
  return new Promise((resolvePromise, reject) => {
    yauzl.open(tempPath, { lazyEntries: true, autoClose: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? new Error("ZIP inválido"));
      let selected = false;
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        if (
          selected ||
          !/\.(?:csv|txt)$/i.test(entry.fileName) ||
          entry.uncompressedSize > 1_500_000_000
        ) {
          zip.readEntry();
          return;
        }
        selected = true;
        zip.openReadStream(entry, async (streamError, stream) => {
          if (streamError || !stream) return reject(streamError ?? new Error("Falha ao ler ZIP"));
          try {
            const kept = [];
            let scanned = 0,
              eligible = 0;
            for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
              scanned++;
              const row = parseRow(line);
              if (!row) continue;
              eligible++;
              kept.push(row);
              if (kept.length > limit * 8)
                kept.splice(0, kept.length, ...uniqueTop(kept, limit * 4));
            }
            resolvePromise({ records: uniqueTop(kept, limit), scanned, eligible });
            zip.close();
          } catch (readError) {
            reject(readError);
          }
        });
      });
      zip.on("end", () => {
        if (!selected) reject(new Error("ZIP sem tabela de eventos"));
      });
      zip.readEntry();
    });
  });
}

try {
  console.log(`Baixando ${archiveUrl}`);
  const bytes = await download();
  console.log(
    `Arquivo recebido: ${(bytes / 1_000_000).toFixed(1)} MB. Selecionando até ${limit} registros...`,
  );
  const { records, scanned, eligible } = await readZip();
  await fs.mkdir(targetDir, { recursive: true });
  const key = `${period}${country ? `-${country}` : ""}`;
  const output = {
    period,
    country: country || null,
    archiveUrl,
    importedAt: new Date().toISOString(),
    scanned,
    eligible,
    selection: `Até ${limit} eventos raiz com local informado, sem duplicatas idênticas e ordenados por menções. Amostra, não acervo completo.`,
    records,
  };
  await fs.writeFile(join(targetDir, `${key}.json`), JSON.stringify(output));
  const existing = await fs.readdir(targetDir);
  const index = [];
  for (const name of existing.filter((name) =>
    /^\d{4}(?:\d{2})?(?:\d{2})?(?:-[A-Z]{2})?\.json$/.test(name),
  )) {
    try {
      const value = JSON.parse(await fs.readFile(join(targetDir, name), "utf8"));
      index.push({
        key: name.slice(0, -5),
        period: value.period,
        country: value.country,
        count: value.records?.length ?? 0,
        importedAt: value.importedAt,
      });
    } catch {
      /* skip malformed imported file */
    }
  }
  index.sort((a, b) => b.period.localeCompare(a.period) || a.key.localeCompare(b.key));
  await fs.writeFile(join(targetDir, "index.json"), JSON.stringify(index));
  console.log(
    `${records.length} registros selecionados de ${eligible} elegíveis (${scanned} linhas). Salvo em public/history/${key}.json`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await fs.rm(tempPath, { force: true });
}
