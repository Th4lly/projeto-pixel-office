"""Corrige os penteados do catálogo já gerado: cada linha das folhas de cabeça do RO é um único
penteado (15 quadros). Versões antigas criavam 3 penteados por linha, e 2 deles eram a cabeça
de costas/de lado — o rosto "sumia". Mantém só o 1º de cada linha e renumera os nomes (os ids ficam)."""
import json, sys, collections
path = sys.argv[1] if len(sys.argv) > 1 else 'docs/assets/catalog.json'
cat = json.load(open(path, encoding='utf-8'))
by = collections.defaultdict(list)
for h in cat['heads']:
    by[(h['s'])].append(h)
keep = []
for sid, L in by.items():
    L.sort(key=lambda h: (h['dirs'][0][1], h['dirs'][0][0]))
    rows, cur, last = [], [], None
    for h in L:
        y = h['dirs'][0][1]
        if last is not None and abs(y - last) > 24:
            rows.append(cur); cur = []
        cur.append(h); last = y if not cur[:-1] else last
    if cur: rows.append(cur)
    n = 0
    for r in rows:
        first = min(r, key=lambda h: h['dirs'][0][0])
        if first['dirs'][0][0] > 60:  # linha sem o começo (sobra de cabelo comprido): descarta
            continue
        n += 1
        first['name'] = f"{'Clássico' if 'original' in first['id'] else 'Cabelo'} {n}"
        keep.append(first)  # o id fica igual: avatares salvos continuam com o mesmo cabelo
print(f'penteados: {len(cat["heads"])} -> {len(keep)}')
cat['heads'] = keep
json.dump(cat, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
