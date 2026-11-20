// Codemod: wrap Russian interface strings in tr() (see src/i18n/index.ts).
// Usage: node scripts/i18n-wrap.mjs file.tsx [...] — rewrites the files in place, repeating until nothing changes.
// Leaves alone: imports, object keys, types, comparisons (=== 'Мытая'), case labels, element access, console.*,
// strings already inside tr(), and lines ending with `// i18n-skip`.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, dirname } from 'node:path';
const ts = createRequire(import.meta.url)('typescript');

const CYR = /[А-Яа-яЁё]/;
const ENT = { nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", thinsp: ' ', times: '×', middot: '·', rarr: '→', larr: '←' };
const decode = (s) => s.replace(/&(#x?[\da-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m);
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";

function skipLiteral(node, sf) {
  const p = node.parent;
  if (!p) return true;
  const line = sf.text.slice(node.getStart(sf)).split('\n')[0];
  const lineEnd = sf.text.indexOf('\n', node.getStart(sf));
  if (/\/\/ i18n-skip/.test(sf.text.slice(sf.text.lastIndexOf('\n', node.getStart(sf)), lineEnd === -1 ? undefined : lineEnd))) return true;
  void line;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isEnumMember(p)) && p.name === node) return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  if (ts.isTaggedTemplateExpression(p)) return true;
  if (ts.isJsxAttribute(p)) return false;
  return inTrOrConsole(node);
}
function inTrOrConsole(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const callee = p.expression.getText();
      if (/^(tr|t|tn|trValue|N_)$/.test(callee) && p.arguments[0] && (p.arguments[0] === node || p.arguments[0].pos <= node.pos && node.end <= p.arguments[0].end)) return true;
      if (/^console\./.test(callee)) return true;
    }
    if (ts.isFunctionLike(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}
const hasJsx = (n) => { let f = false; const v = (x) => { if (f) return; if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) f = true; else ts.forEachChild(x, v); }; v(n); return f; };

function pass(file) {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const covered = (s, e) => edits.some((x) => x.s <= s && e <= x.e);
  const visit = (node) => {
    // JSX children: runs of text and plain expressions become one string
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const kids = node.children;
      let run = [];
      const flush = () => {
        if (run.some((k) => ts.isJsxText(k) && CYR.test(k.text))) {
          // JSX whitespace: lines are trimmed, line breaks inside text become spaces
          const parts = []; const args = [];
          for (const k of run) {
            if (ts.isJsxText(k)) parts.push(decode(k.text));
            else { parts.push(`{${args.length}}`); args.push(k.expression.getText(sf)); }
          }
          let str = parts.join('');
          const lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];
          let core = str.slice(lead.length, str.length - trail.length).replace(/\s*\n\s*/g, ' ');
          const keep = (w) => (w.includes('\n') ? w.replace(/[^\n]/g, '').replace(/\n/g, '\n') : w);
          const s = run[0].getStart(sf, false) - (ts.isJsxText(run[0]) ? 0 : 0), e = run[run.length - 1].end;
          const start = ts.isJsxText(run[0]) ? run[0].pos : run[0].getStart(sf);
          const leadSrc = lead.includes('\n') ? '\n' : lead.replace(/ /g, '{"\\u00a0"}');
          const trailSrc = trail.includes('\n') ? '\n' : trail.replace(/ /g, '{"\\u00a0"}');
          void s; void keep;
          edits.push({ s: start, e, t: `${leadSrc}{tr(${[q(core), ...args].join(', ')})}${trailSrc}` });
        }
        run = [];
      };
      for (const k of kids) {
        if (ts.isJsxText(k) || (ts.isJsxExpression(k) && k.expression && !hasJsx(k.expression) && !ts.isStringLiteral(k.expression) && !CYR.test(k.expression.getText(sf)))) run.push(k);
        else flush();
      }
      flush();
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && CYR.test(node.text) && !skipLiteral(node, sf)) {
      const s = node.getStart(sf), e = node.end;
      if (!covered(s, e)) edits.push({ s, e, t: ts.isJsxAttribute(node.parent) ? `{tr(${q(node.text)})}` : `tr(${q(node.text)})` });
      return;
    }
    if (ts.isTemplateExpression(node) && !ts.isTaggedTemplateExpression(node.parent) && [node.head, ...node.templateSpans.map((x) => x.literal)].some((x) => CYR.test(x.text)) && !inTrOrConsole(node)) {
      const s = node.getStart(sf), e = node.end;
      if (!covered(s, e)) {
        let str = node.head.text; const args = [];
        node.templateSpans.forEach((sp, i) => { str += `{${i}}` + sp.literal.text; args.push(sp.expression.getText(sf)); });
        edits.push({ s, e, t: `tr(${[q(str), ...args].join(', ')})` });
        return; // inner templates get their turn on the next pass
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!edits.length) return false;
  // outermost edits only; inner ones come on the next pass
  const outer = edits.filter((x) => !edits.some((y) => y !== x && y.s <= x.s && x.e <= y.e));
  let out = text;
  for (const x of outer.sort((a, b) => b.s - a.s)) out = out.slice(0, x.s) + x.t + out.slice(x.e);
  writeFileSync(file, out);
  return true;
}

function addImport(file) {
  let text = readFileSync(file, 'utf8');
  const need = ['tr', 'intlLocale', 'decSep', 'trValue', 'N_'].filter((n) => new RegExp(`\\b${n}\\(`).test(text));
  if (!need.length) return;
  let rel = relative(dirname(file), 'src/i18n').replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  const re = new RegExp(`import \\{([^}]*)\\} from '${rel.replace(/[./]/g, (c) => '\\' + c)}';`);
  const m = text.match(re);
  if (m) {
    const have = m[1].split(',').map((x) => x.trim()).filter(Boolean);
    const all = [...new Set([...have, ...need])].sort((a, b) => a.localeCompare(b));
    text = text.replace(re, `import { ${all.join(', ')} } from '${rel}';`);
  } else {
    // after the last import
    const imports = [...text.matchAll(/^import [^;]+;$/gm)];
    const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0;
    text = text.slice(0, at) + (at ? '\n' : '') + `import { ${need.join(', ')} } from '${rel}';` + (at ? '' : '\n') + text.slice(at);
  }
  writeFileSync(file, text);
}

for (const f of process.argv.slice(2)) {
  let n = 0;
  while (pass(f) && n < 8) n++;
  addImport(f);
}
