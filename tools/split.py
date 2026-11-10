import re, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

s = open('index_orig.html', encoding='utf-8').read()
print('total', len(s))

# script blocks after the db
k = s.find('<script id="db"')
end_db = s.find('</script>', k) + len('</script>')
tail = s[end_db:]
print('tail len', len(tail))
open('tools/tail.html', 'w', encoding='utf-8').write(tail)

# region before db (head + body up to db)
head = s[:k]
open('tools/head.html', 'w', encoding='utf-8').write(head)
print('head len', len(head))

# count templates
print('templates:', len(re.findall(r'<template', tail)))
for m in re.finditer(r'<template([^>]*)>', tail):
    print(' ', m.start(), m.group(1)[:100])
