"""Match NextHalf squad players to real game ratings and report results.

usage: python3 -I match.py <era: now|retro> <ratings dir> <repo dir> [--write]
"""
import csv, collections, json, re, sys, unicodedata

era, RD, REPO = sys.argv[1], sys.argv[2], sys.argv[3]
WRITE = '--write' in sys.argv

SPECIAL = str.maketrans({'ß': 'ss', 'ð': 'd', 'Ð': 'd', 'ł': 'l', 'Ł': 'l', 'ø': 'o', 'Ø': 'o', 'æ': 'ae', 'þ': 'th', 'ı': 'i', 'đ': 'd', 'Đ': 'd'})
def norm(s):
    s = unicodedata.normalize('NFKD', s.translate(SPECIAL)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', s.replace('-', ' '))).strip()

def _unused(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'[^a-z0-9 ]+', ' ', s.replace('-', ' '))
    return re.sub(r'\s+', ' ', s).strip()

STOP = {'fc', 'cf', 'club', 'de', 'the', 'ac', 'as', 'sc', 'sl', 'afc', 'ssc', 'vfl', 'cd', 'ud', 'futbol', 'football', 'calcio', 'sporting', '1', 'clube', 'and', 'hotspur', 'city', 'united'}
def ctoks(s):
    return {t for t in norm(s).split() if t not in STOP}

# ---- load the game's data file ----
path = f'{REPO}/js/data-{era}.js'
src = open(path, encoding='utf-8').read()
teams = []  # (name, kind, players-string span)
for m in re.finditer(r"\{ id: '([^']+)', name: '((?:[^'\\]|\\.)*)'.*?players: '((?:[^'\\]|\\.)*)' \}", src, re.S):
    teams.append((m.group(1), m.group(2).replace("\\'", "'"), m.group(3), m.start(3), m.end(3)))

GROUP = {'GK': 'G', 'CB': 'D', 'LB': 'D', 'RB': 'D', 'LWB': 'D', 'RWB': 'D', 'CDM': 'M', 'CM': 'M', 'CAM': 'M', 'LM': 'W', 'RM': 'W',
         'LW': 'W', 'RW': 'W', 'ST': 'F', 'CF': 'F', 'LF': 'F', 'RF': 'F', 'SS': 'F'}
def pos_miss(ours, theirs):
    # 0 = same position, 1 = same area of the pitch, 2 = different
    return 0 if ours == theirs else 1 if GROUP.get(ours) == GROUP.get(theirs) else 2

# ---- load source ratings: list of (variants, club, ovr, pos) ----
recs = []
fallback = []
if era == 'now':
    for r in csv.DictReader(open(f'{RD}/EA_FC_ANALYSIS/EA_FC_PLAYERS_DATASET_AND_ DASHBOARD/data/players.csv', encoding='utf-8')):
        if r.get('gender', 'M').lower().startswith('f'):
            continue
        v = {norm(f"{r['first_name']} {r['last_name']}"), norm(r['last_name'])}
        if r['common_name'].strip():
            v.add(norm(r['common_name']))
        recs.append((v, r['club'], int(r['overall_rating']), r['position'], f"{r['first_name']} {r['last_name']}".strip() or r['common_name']))
else:
    # lowest card per (name, club) is the launch card; keep clubs apart so namesakes don't merge
    best = {}
    for r in csv.DictReader(open(f'{RD}/fifa15_fut.csv', encoding='utf-8')):
        k = (norm(r['NAME']), r['CLUB'], GROUP.get(r['POSITION']))
        if k not in best or int(r['RATING']) < best[k][2]:
            best[k] = ({k[0]}, r['CLUB'], int(r['RATING']), r['POSITION'], r['NAME'])
    recs = list(best.values())
    # goalkeepers and some outfield players are missing from the card data: use the season file
    import html
    for r in csv.DictReader(open(f'{RD}/fifa_model/stats/player_stats_2015.csv', encoding='utf-8')):
        nm = html.unescape(r['name'])
        pos = 'GK' if 'GK' in r['preferred_positions'] else 'FM'
        if int(r['rating']) >= 50:  # a few rows in this file are junk (e.g. 39)
            fallback.append(({norm(nm)}, html.unescape(r['club']), int(r['rating']), pos, nm))

def index(rs):
    bv, bl = collections.defaultdict(list), collections.defaultdict(list)
    for rec in rs:
        for v in rec[0]:
            bv[v].append(rec)
            bl[v.split()[-1]].append(rec)
    return bv, bl
INDEXES = [index(recs)] + ([index(fallback)] if fallback else [])

ALIAS = json.load(open(f'{RD}/alias_{era}.json')) if __import__('os').path.exists(f'{RD}/alias_{era}.json') else {}

def club_score(team_name, rec_club):
    a, b = ctoks(team_name), ctoks(rec_club)
    return len(a & b)

def find(name, team_name, pos):
    key = ALIAS.get(name, name)
    if key == '__skip__':
        return None, 'skipped'
    if '|' in key:
        src_name, club = key.split('|')
        for bv, _ in INDEXES:
            c = [r for r in bv.get(norm(src_name), []) if norm(club) in norm(r[1])]
            if c:
                return sorted(c, key=lambda r: (pos_miss(pos, r[3]), r[2]))[0], 'alias'
        return None, 'alias-miss'
    for bv, bl in INDEXES:
        rec, how = find_in(bv, bl, key, team_name, pos)
        if rec:
            return rec, how
    return None, 'none'

def find_in(by_variant, by_last, key, team_name, pos):
    n = norm(key)
    cands = by_variant.get(n, [])
    how = 'exact'
    if not cands:
        parts = n.split()
        last = parts[-1]
        cands = [c for c in by_last.get(last, []) if all(any(t.startswith(p[:3]) for v in c[0] for t in v.split()) for p in parts[:-1])] or []
        how = 'last+first'
        if not cands and len(parts) > 1:
            cands = [c for c in by_last.get(last, []) if club_score(team_name, c[1]) > 0
                     and any(len(v.split()) == 1 or v.split()[0][:3] == parts[0][:3] for v in c[0] if v.split()[-1] == last)]
            how = 'last+club'
        if not cands:
            # one-word source names ("Falcao") must also agree on club
            cands = [c for c in by_variant.get(last, []) if any(len(v.split()) == 1 for v in c[0]) and club_score(team_name, c[1]) > 0]
            how = 'one-name'
    if not cands:
        return None, 'none'
    if pos != 'GK':
        cands = [c for c in cands if c[3] != 'GK'] or cands
    gk = pos == 'GK'
    cands = sorted(cands, key=lambda c: (-(c[3] == 'GK') if gk else (c[3] == 'GK'), -club_score(team_name, c[1]), pos_miss(pos, c[3]), c[2]))
    if len(cands) > 1 and club_score(team_name, cands[0][1]) == 0 and len({c[4] for c in cands}) > 1 and len({c[2] for c in cands}) > 1:
        return cands[0], how + '?'  # ambiguous
    return cands[0], how

out = {}
report = collections.Counter()
rows = []
for tid, tname, pstr, a, b in teams:
    for entry in pstr.split(';'):
        f = entry.split(',')
        name, pos, ovr = f[0].replace("\\'", "'"), f[1], int(f[2])
        rec, how = find(name, tname, pos)
        report[how] += 1
        if rec:
            out.setdefault(name, rec[2])
        rows.append((how, tname, name, pos, ovr, rec[4] if rec else '', rec[1] if rec else '', rec[2] if rec else ''))

print(era, dict(report))
for r in rows:
    if r[0] not in ('exact', 'last+first') and not (r[0] == 'none' and r[2] in out):
        print('  ', r)
print('distinct names', len({r[2] for r in rows}), 'matched', len(out))
json.dump(out, open(f'{RD}/new_{era}.json', 'w'), indent=0)

if WRITE:
    def fix(m):
        parts = []
        for entry in m.group(3).split(';'):
            f = entry.split(',')
            nm = f[0].replace("\\'", "'")
            if nm in out:
                f[2] = str(out[nm])
            parts.append(','.join(f))
        return m.group(0)[:m.start(3) - m.start(0)] + ';'.join(parts) + m.group(0)[m.end(3) - m.start(0):]
    new = re.sub(r"\{ id: '([^']+)', name: '((?:[^'\\]|\\.)*)'.*?players: '((?:[^'\\]|\\.)*)' \}", fix, src, flags=re.S)
    open(path, 'w', encoding='utf-8').write(new)
    print('wrote', path)
