"""Add translations: python3 scripts/i18n-add.py 'Русский текст' 'English' [...pairs]. Rebuild order with i18n-build-en.py."""
import json, sys
p = 'src/i18n/en-strings.ts'; s = open(p, encoding='utf-8').read()
a = sys.argv[1:]
lines = ''.join(f'  {json.dumps(a[i], ensure_ascii=False)}: {json.dumps(a[i+1], ensure_ascii=False)},\n' for i in range(0, len(a), 2))
i = s.rindex('};'); s = s[:i] + lines + s[i:]
open(p, 'w', encoding='utf-8').write(s)
