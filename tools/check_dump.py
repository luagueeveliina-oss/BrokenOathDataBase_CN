import re, io, sys, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
for p in ['tools/dump_uniques.html', 'tools/dump_rw.html', 'tools/dump_bases.html']:
    s = open(p, encoding='utf-8').read()
    text = re.sub(r'<[^>]+>', '\n', s)
    print('=' * 30, p, len(s))
    probs = {
        'braces': re.findall(r'\{[a-z0-9]+\}', text),
        'undefined': re.findall(r'undefined|null|NaN', text),
        'double-space': len(re.findall(r'[^\s]  +[^\s]', text)),
        'pipe': re.findall(r'\|plural[^)）]*\)', text),
        'en-leak': re.findall(r'\b(increased|reduced|maximum Life|Damage with|per second)\b', text)[:5],
    }
    for k, v in probs.items():
        print(' ', k, (len(v) if isinstance(v, list) else v), (v[:6] if isinstance(v, list) else ''))
    # first card text
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    print('  sample:', ' | '.join(lines[:26])[:900])
