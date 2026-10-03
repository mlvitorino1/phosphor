import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

let files = null;
try {
  files = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\0")
    .filter(Boolean);
} catch {
  // Source archives have no Git metadata; their environment template can still be checked.
}
const privatePath =
  /(^|\/)(data|\.aws|\.ssh|\.auth|node_modules|\.next|\.vercel)(\/|$)|\.(pem|key|p12|pfx|log)$|(^|\/)(id_rsa|id_ed25519|\.npmrc|local-state\.json)$|(^|\/)service-account[^/]*\.json$/i;
const forbidden = (files ?? []).filter((path) => {
  const name = path.split("/").at(-1);
  return privatePath.test(path) || (name.startsWith(".env") && path !== ".env.example");
});
const template = readFileSync(".env.example", "utf8");
const nonempty = template.split(/\r?\n/).some((line) => /^\s*[A-Z][A-Z0-9_]*\s*=\s*\S/i.test(line));
if (forbidden.length || nonempty) {
  // Print only paths: never include a matching value or credential in diagnostics.
  for (const path of forbidden) console.error(`Arquivo privado no Git: ${path}`);
  if (nonempty) console.error(".env.example deve conter somente valores vazios");
  process.exitCode = 1;
} else if (files) {
  console.info(
    `Publicação: ${files.length} arquivos rastreados; nenhum arquivo privado; template vazio.`,
  );
} else {
  console.info("Template vazio. A verificação de arquivos rastreados exige um checkout Git.");
}
