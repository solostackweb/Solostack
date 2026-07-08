/* eslint-disable @typescript-eslint/no-require-imports */
const ts = require('typescript');
const fs = require('fs');
const files = [
  'src/app/(portal)/layout.tsx',
  'src/app/(portal)/portal/page.tsx',
  'src/app/(portal)/portal/accept/page.tsx',
  'src/app/(portal)/portal/[id]/page.tsx',
  'src/features/portals/components/portal-view.tsx',
];
let bad = 0;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(f, 'MISSING'); continue; }
  const src = fs.readFileSync(f, 'utf8');
  const kind = f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, kind);
  const errs = sf.parseDiagnostics || [];
  console.log(f, 'parse-errors:', errs.length);
  for (const e of errs.slice(0,4)) {
    const lc = sf.getLineAndCharacterOfPosition(e.start ?? 0);
    console.log('  L' + (lc.line+1) + ':' + (lc.character+1), ts.flattenDiagnosticMessageText(e.messageText, '\n'));
  }
  if (errs.length) bad++;
}
console.log(bad === 0 ? 'ALL PARSE OK' : 'FAILURES ' + bad);
