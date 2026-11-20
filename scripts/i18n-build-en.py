"""Merge numbered translations (N<TAB>English, numbers from the ordered key list) into src/i18n/en-strings.ts.
Existing entries in en-strings.ts are kept; new ones are appended under their file."""
import json, sys, re, glob
ordered, *tr_files = sys.argv[1:]
o = json.load(open(ordered))
tr = {}
for f in tr_files:
    for line in open(f, encoding='utf-8').read().split('\n'):
        if line.strip():
            n, _, t = line.partition('\t'); tr[int(n)] = t
path = 'src/i18n/en-strings.ts'
src = open(path, encoding='utf-8').read()
head = src[:src.index('export const EN')]
old = {}
for m in re.finditer(r"^  (\".*?\"|'.*?'): (\".*?\"|'.*?'),$", src, re.M):
    old[json.loads(m.group(1)) if m.group(1)[0] == '"' else m.group(1)[1:-1]] = json.loads(m.group(2)) if m.group(2)[0] == '"' else m.group(2)[1:-1]
out = []; last = None; seen = set()
for i, (f, k) in enumerate(o):
    en = tr.get(i, old.get(k))
    if en is None or k in seen: continue
    seen.add(k)
    if f != last: out.append(f'  // {f}'); last = f
    out.append(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(en, ensure_ascii=False)},')
extra = [k for k in old if k not in seen]
if extra:
    out.append('  // not in tr() calls: messages from the server (shown with trValue), stored values')
    out += [f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(old[k], ensure_ascii=False)},' for k in extra]
    seen.update(extra)
open(path, 'w', encoding='utf-8').write(head + 'export const EN: Record<string, string> = {\n' + '\n'.join(out) + '\n};\n')
print(len(seen), 'entries')
