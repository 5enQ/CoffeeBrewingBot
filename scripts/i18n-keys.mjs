// Lists the interface strings: every tr('…') and N_('…') key in src/ (one JSON array on stdout),
// or with --loose, Russian text in the code that is not inside tr()/N_() (comments aside).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const ts = createRequire(import.meta.url)('typescript');
const CYR = /[А-Яа-яЁё]/;
const files = execSync("git ls-files 'src/*.ts' 'src/*.tsx'", { encoding: 'utf8' }).split('\n').filter((f) => f && !f.startsWith('src/i18n/'));
const keys = new Set(); const loose = []; const ordered = [];
for (const f of files) {
  const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const marked = (n) => { for (let p = n.parent; p; p = p.parent) { if (ts.isCallExpression(p) && /^(tr|N_|t|tn)$/.test(p.expression.getText(sf)) && p.arguments[0] && p.arguments[0].pos <= n.pos && n.end <= p.arguments[0].end) return true; if (ts.isFunctionLike(p)) return false; } return false; };
  const visit = (n) => {
    if (ts.isCallExpression(n) && /^(tr|N_)$/.test(n.expression.getText(sf)) && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) { if (!keys.has(n.arguments[0].text)) ordered.push([f, n.arguments[0].text]); keys.add(n.arguments[0].text); }
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) && CYR.test(n.text) && !marked(n)) loose.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${n.text.trim().slice(0, 90)}`);
    else if (ts.isTemplateExpression(n) && CYR.test(n.getText(sf)) && !marked(n) && [n.head, ...n.templateSpans.map((s) => s.literal)].some((x) => CYR.test(x.text))) loose.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: \`${n.getText(sf).slice(1, 90)}`);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
if (process.argv.includes('--loose')) console.log(loose.join('\n'));
else if (process.argv.includes('--ordered')) console.log(JSON.stringify(ordered));
else console.log(JSON.stringify([...keys].sort(), null, 0));
