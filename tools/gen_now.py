"""Build js/data-now.js from EA's FC 27 ratings (players.csv). usage: python3 -I gen_now.py <players.csv> <out.js>"""
import csv, sys, unicodedata, collections

SRC, OUT = sys.argv[1], sys.argv[2]
rows = [r for r in csv.DictReader(open(SRC, encoding='utf-8')) if r['gender'] == "Men's Football"]

LEAGUE = {'Premier League': 'Premier League', 'LALIGA EA SPORTS': 'LaLiga', 'Serie A Enilive': 'Serie A', "Ligue 1 McDonald's": 'Ligue 1',
          'Bundesliga': 'Bundesliga', 'Liga Portugal': 'Liga Portugal', 'Eredivisie': 'Eredivisie', 'Trendyol Süper Lig': 'Super Lig',
          'Eliteserien': 'Eliteserien', '1A Pro League': 'Pro League', 'Ö. Bundesliga': 'Austrian Bundesliga', 'Ukrayina Liha': 'Ukrainian PL',
          'Česká Liga': 'Czech Liga', 'Hellas Liga': 'Super League Greece'}

# (EA club name, id, display name, short, kit)
CLUBS = [
    ('AFC Bournemouth', 'bou', 'Bournemouth', 'BOU', ['#da291c', '#000000', 'stripes']),
    ('Arsenal', 'ars', 'Arsenal', 'ARS', ['#ef0107', '#ffffff', 'sleeves']),
    ('Aston Villa', 'avl', 'Aston Villa', 'AVL', ['#670e36', '#95bfe5', 'sleeves']),
    ('Brentford', 'bre', 'Brentford', 'BRE', ['#e30613', '#ffffff', 'stripes']),
    ('Brighton', 'bri', 'Brighton', 'BHA', ['#0057b8', '#ffffff', 'solid']),
    ('Chelsea', 'che', 'Chelsea', 'CHE', ['#034694', '#ffffff', 'solid']),
    ('Coventry City', 'cov', 'Coventry City', 'COV', ['#6cb4ee', '#ffffff', 'solid']),
    ('Crystal Palace', 'cry', 'Crystal Palace', 'CRY', ['#1b458f', '#c4122e', 'stripes']),
    ('Everton', 'eve', 'Everton', 'EVE', ['#003399', '#ffffff', 'solid']),
    ('Fulham', 'ful', 'Fulham', 'FUL', ['#ffffff', '#000000', 'solid']),
    ('Hull City', 'hul', 'Hull City', 'HUL', ['#f5a12d', '#000000', 'stripes']),
    ('Ipswich', 'ips', 'Ipswich Town', 'IPS', ['#0044a9', '#ffffff', 'solid']),
    ('Leeds United', 'lee', 'Leeds United', 'LEE', ['#ffffff', '#1d428a', 'solid']),
    ('Liverpool', 'liv', 'Liverpool', 'LIV', ['#c8102e', '#f6eb61', 'solid']),
    ('Man Utd', 'mun', 'Manchester United', 'MUN', ['#da291c', '#000000', 'solid']),
    ('Manchester City', 'mci', 'Manchester City', 'MCI', ['#6cabdd', '#1c2c5b', 'solid']),
    ('Newcastle Utd', 'new', 'Newcastle', 'NEW', ['#241f20', '#ffffff', 'stripes']),
    ("Nott'm Forest", 'nfo', 'Nottingham Forest', 'NFO', ['#dd0000', '#ffffff', 'solid']),
    ('Spurs', 'tot', 'Tottenham', 'TOT', ['#ffffff', '#132257', 'solid']),
    ('Sunderland', 'sun', 'Sunderland', 'SUN', ['#eb172b', '#ffffff', 'stripes']),
    ('AEK Athens', 'aek', 'AEK Athens', 'AEK', ['#ffd100', '#000000', 'solid']),
    ('Atlético de Madrid', 'atm', 'Atletico Madrid', 'ATM', ['#cb3524', '#ffffff', 'stripes']),
    ('FC Barcelona', 'bar', 'Barcelona', 'BAR', ['#a50044', '#004d98', 'stripes']),
    ('FC Bayern München', 'fcb', 'Bayern Munich', 'FCB', ['#dc052d', '#ffffff', 'solid']),
    ('FK Bodø/Glimt', 'bod', 'Bodo/Glimt', 'BOD', ['#ffd700', '#000000', 'solid']),
    ('Borussia Dortmund', 'bvb', 'Dortmund', 'BVB', ['#fde100', '#000000', 'solid']),
    ('Club Brugge', 'cbr', 'Club Brugge', 'CLU', ['#0074c1', '#000000', 'stripes']),
    ('Como', 'com', 'Como', 'COM', ['#1e4a8a', '#ffffff', 'solid']),
    ('Fenerbahçe', 'fen', 'Fenerbahce', 'FEN', ['#ffed00', '#00205b', 'stripes']),
    ('Feyenoord', 'fey', 'Feyenoord', 'FEY', ['#e30613', '#ffffff', 'halves']),
    ('Galatasaray', 'gs', 'Galatasaray', 'GS', ['#a90432', '#fdb912', 'halves']),
    ('Lombardia FC', 'int', 'Inter', 'INT', ['#010e80', '#000000', 'stripes']),
    ('LASK', 'lask', 'LASK', 'LASK', ['#000000', '#ffffff', 'stripes']),
    ('RB Leipzig', 'rbl', 'RB Leipzig', 'RBL', ['#ffffff', '#dd0741', 'solid']),
    ('RC Lens', 'rcl', 'Lens', 'RCL', ['#ffd200', '#e30613', 'solid']),
    ('LOSC Lille', 'los', 'Lille', 'LIL', ['#e01e13', '#1c2c5b', 'solid']),
    ('SSC Napoli', 'nap', 'Napoli', 'NAP', ['#12a0d7', '#ffffff', 'solid']),
    ('Paris SG', 'psg', 'Paris SG', 'PSG', ['#004170', '#da291c', 'band']),
    ('FC Porto', 'fcp', 'Porto', 'POR', ['#1c3f94', '#ffffff', 'stripes']),
    ('PSV', 'psv', 'PSV', 'PSV', ['#ed1c24', '#ffffff', 'stripes']),
    ('Real Betis', 'bet', 'Real Betis', 'BET', ['#00954c', '#ffffff', 'stripes']),
    ('Real Madrid', 'rma', 'Real Madrid', 'RMA', ['#ffffff', '#febe10', 'solid']),
    ('AS Roma', 'rom', 'Roma', 'ROM', ['#8e1f2f', '#f0bc42', 'solid']),
    ('Shakhtar Donetsk', 'sha', 'Shakhtar Donetsk', 'SHA', ['#f47c20', '#000000', 'solid']),
    ('Slavia Praha', 'sla', 'Slavia Praha', 'SLA', ['#e41b23', '#ffffff', 'halves']),
    ('Sporting CP', 'scp', 'Sporting CP', 'SCP', ['#008057', '#ffffff', 'hoops']),
    ('VfB Stuttgart', 'vfb', 'Stuttgart', 'VFB', ['#ffffff', '#e32219', 'solid']),
    ('Viking FK', 'vik', 'Viking', 'VIK', ['#003b70', '#ffffff', 'solid']),
    ('Villarreal CF', 'vil', 'Villarreal', 'VIL', ['#ffe667', '#005187', 'solid']),
]
PL = ['bou', 'ars', 'avl', 'bre', 'bri', 'che', 'cov', 'cry', 'eve', 'ful', 'hul', 'ips', 'lee', 'liv', 'mun', 'mci', 'new', 'nfo', 'tot', 'sun']
# 2026/27 league phase; Sabah and Slovan Bratislava are not in FC 27
UCL = ['aek', 'ars', 'avl', 'atm', 'bar', 'fcb', 'bod', 'bvb', 'cbr', 'com', 'fen', 'fey', 'gs', 'int', 'lask', 'rbl', 'rcl', 'los', 'liv',
       'mci', 'mun', 'nap', 'psg', 'fcp', 'psv', 'bet', 'rma', 'rom', 'sha', 'sla', 'scp', 'vfb', 'vik', 'vil']

# (EA nationality, id, display, short, code, confederation, kit)
NATIONS = [
    ('Argentina', 'n_arg', 'Argentina', 'ARG', 'AR', 'CONMEBOL', ['#75aadb', '#ffffff', 'stripes']),
    ('Brazil', 'n_bra', 'Brazil', 'BRA', 'BR', 'CONMEBOL', ['#fedf00', '#009c3b', 'solid']),
    ('France', 'n_fra', 'France', 'FRA', 'FR', 'UEFA', ['#21304d', '#ed2939', 'solid']),
    ('England', 'n_eng', 'England', 'ENG', 'EN', 'UEFA', ['#ffffff', '#1d2d5c', 'solid']),
    ('Spain', 'n_esp', 'Spain', 'ESP', 'ES', 'UEFA', ['#c60b1e', '#ffc400', 'solid']),
    ('Germany', 'n_ger', 'Germany', 'GER', 'DE', 'UEFA', ['#ffffff', '#000000', 'solid']),
    ('Portugal', 'n_por', 'Portugal', 'POR', 'PT', 'UEFA', ['#da291c', '#046a38', 'solid']),
    ('Holland', 'n_ned', 'Netherlands', 'NED', 'NL', 'UEFA', ['#f36c21', '#ffffff', 'solid']),
    ('Italy', 'n_ita', 'Italy', 'ITA', 'IT', 'UEFA', ['#0066b2', '#ffffff', 'solid']),
    ('Belgium', 'n_bel', 'Belgium', 'BEL', 'BE', 'UEFA', ['#e30613', '#fdda24', 'solid']),
    ('Croatia', 'n_cro', 'Croatia', 'CRO', 'HR', 'UEFA', ['#ffffff', '#e30613', 'checks']),
    ('Uruguay', 'n_uru', 'Uruguay', 'URU', 'UY', 'CONMEBOL', ['#5cbfeb', '#000000', 'solid']),
    ('United States', 'n_usa', 'USA', 'USA', 'US', 'CONCACAF', ['#ffffff', '#0a3161', 'solid']),
    ('Mexico', 'n_mex', 'Mexico', 'MEX', 'MX', 'CONCACAF', ['#006847', '#ffffff', 'solid']),
    ('Morocco', 'n_mar', 'Morocco', 'MAR', 'MA', 'CAF', ['#c1272d', '#006233', 'solid']),
    ('Japan', 'n_jpn', 'Japan', 'JPN', 'JP', 'AFC', ['#000555', '#ffffff', 'solid']),
    ('Colombia', 'n_col', 'Colombia', 'COL', 'CO', 'CONMEBOL', ['#fcd116', '#003893', 'solid']),
    ('Norway', 'n_nor', 'Norway', 'NOR', 'NO', 'UEFA', ['#ba0c2f', '#00205b', 'solid']),
    ('Senegal', 'n_sen', 'Senegal', 'SEN', 'SN', 'CAF', ['#ffffff', '#00853f', 'solid']),
    ('Ecuador', 'n_ecu', 'Ecuador', 'ECU', 'EC', 'CONMEBOL', ['#ffdd00', '#034ea2', 'solid']),
    ('Switzerland', 'n_sui', 'Switzerland', 'SUI', 'CH', 'UEFA', ['#d52b1e', '#ffffff', 'solid']),
    ('Korea Republic', 'n_kor', 'Korea Republic', 'KOR', 'KR', 'AFC', ['#e4002b', '#000000', 'solid']),
    ('Turkey', 'n_tur', 'Turkiye', 'TUR', 'TR', 'UEFA', ['#e30a17', '#ffffff', 'solid']),
    ('Canada', 'n_can', 'Canada', 'CAN', 'CA', 'CONCACAF', ['#d80621', '#ffffff', 'solid']),
    ('Egypt', 'n_egy', 'Egypt', 'EGY', 'EG', 'CAF', ['#ce1126', '#ffffff', 'solid']),
]

ISO = {'Argentina': 'AR', 'Brazil': 'BR', 'France': 'FR', 'England': 'EN', 'Scotland': 'SCO', 'Wales': 'WA', 'Northern Ireland': 'NIR',
       'Spain': 'ES', 'Germany': 'DE', 'Portugal': 'PT', 'Holland': 'NL', 'Italy': 'IT', 'Belgium': 'BE', 'Croatia': 'HR', 'Uruguay': 'UY',
       'United States': 'US', 'Mexico': 'MX', 'Morocco': 'MA', 'Japan': 'JP', 'Colombia': 'CO', 'Norway': 'NO', 'Senegal': 'SN',
       'Ecuador': 'EC', 'Switzerland': 'CH', 'Korea Republic': 'KR', 'Türkiye': 'TR', 'Turkey': 'TR', 'Canada': 'CA', 'Poland': 'PL',
       'Egypt': 'EG', 'Sweden': 'SE', 'Georgia': 'GE', 'Slovenia': 'SI', 'Austria': 'AT', 'Denmark': 'DK', 'Slovakia': 'SK',
       'Cameroon': 'CM', 'Ghana': 'GH', 'Serbia': 'RS', 'Hungary': 'HU', 'Congo DR': 'CD', 'DR Congo': 'CD', 'Guinea': 'GN',
       'Algeria': 'DZ', 'Armenia': 'AM', 'Kosovo': 'XK', 'Ivory Coast': 'CI', "Côte d'Ivoire": 'CI', 'Nigeria': 'NG',
       'Republic of Ireland': 'IE', 'Ireland': 'IE', 'Ukraine': 'UA', 'Czechia': 'CZ', 'Czech Republic': 'CZ', 'Greece': 'GR',
       'Paraguay': 'PY', 'Mozambique': 'MZ', 'Zimbabwe': 'ZW', 'Haiti': 'HT', 'Gambia': 'GM', 'Tunisia': 'TN', 'South Africa': 'ZA',
       'New Zealand': 'NZ', 'Burkina Faso': 'BF', 'Montenegro': 'ME', 'Albania': 'AL', 'Bosnia and Herzegovina': 'BA', 'Bosnia & Herzegovina': 'BA',
       'Mali': 'ML', 'Gabon': 'GA', 'Central African Republic': 'CF', 'Romania': 'RO', 'Israel': 'IL', 'Liberia': 'LR', 'Iran': 'IR',
       'Russia': 'RU', 'Belarus': 'BY', 'Kazakhstan': 'KZ', 'Azerbaijan': 'AZ', 'Peru': 'PE', 'Cape Verde': 'CV', 'Cape Verde Islands': 'CV',
       'Luxembourg': 'LU', 'Chile': 'CL', 'Venezuela': 'VE', 'Finland': 'FI', 'Iceland': 'IS', 'Bulgaria': 'BG', 'North Macedonia': 'MK',
       'Australia': 'AU', 'Jamaica': 'JM', 'Costa Rica': 'CR', 'Honduras': 'HN', 'Panama': 'PA', 'Angola': 'AO', 'Benin': 'BJ', 'Togo': 'TG',
       'Kenya': 'KE', 'Congo': 'CG', 'Zambia': 'ZM', 'Uzbekistan': 'UZ', 'Iraq': 'IQ', 'Saudi Arabia': 'SA', 'Qatar': 'QA', 'China PR': 'CN',
       'Lithuania': 'LT', 'Latvia': 'LV', 'Estonia': 'EE', 'Cyprus': 'CY', 'Malta': 'MT', 'Moldova': 'MD', 'Faroe Islands': 'FO',
       'Equatorial Guinea': 'GQ', 'Guinea-Bissau': 'GW', 'Sierra Leone': 'SL', 'Madagascar': 'MG', 'Comoros': 'KM', 'Mauritania': 'MR',
       'Sudan': 'SD', 'Libya': 'LY', 'Syria': 'SY', 'Jordan': 'JO', 'Lebanon': 'LB', 'Palestine': 'PS', 'Curaçao': 'CW', 'Suriname': 'SR',
       'Trinidad and Tobago': 'TT', 'Grenada': 'GD', 'Bolivia': 'BO', 'Guadeloupe': 'GP', 'Martinique': 'MQ', 'French Guiana': 'GF',
       'Burundi': 'BI', 'Rwanda': 'RW', 'Uganda': 'UG', 'Tanzania': 'TZ', 'Ethiopia': 'ET', 'Namibia': 'NA', 'Philippines': 'PH',
       'Indonesia': 'ID', 'Thailand': 'TH', 'Vietnam': 'VN', 'Montserrat': 'MS', 'Bermuda': 'BM', 'Dominican Republic': 'DO',
       'Puerto Rico': 'PR', 'Cuba': 'CU', 'El Salvador': 'SV', 'Guatemala': 'GT', 'Nicaragua': 'NI', 'Belize': 'BZ', 'Andorra': 'AD',
       'Liechtenstein': 'LI', 'San Marino': 'SM', 'Gibraltar': 'GI', 'Chad': 'TD', 'Niger': 'NE', 'Eritrea': 'ER', 'Somalia': 'SO',
       'South Sudan': 'SS', 'Malawi': 'MW', 'Botswana': 'BW', 'Lesotho': 'LS', 'Eswatini': 'SZ', 'Mauritius': 'MU', 'Seychelles': 'SC'}

POS = {'LM': 'LW', 'RM': 'RW', 'LWB': 'LB', 'RWB': 'RB', 'CF': 'ST'}
BUCKET = {'GK': 'GK', 'CB': 'DEF', 'LB': 'DEF', 'RB': 'DEF', 'CDM': 'MID', 'CM': 'MID', 'CAM': 'MID', 'LW': 'ATT', 'RW': 'ATT', 'ST': 'ATT'}
QUOTA = {'GK': 2, 'DEF': 5, 'MID': 5, 'ATT': 4}

def plain(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()

def display(r):
    first, last, common = r['first_name'].strip(), r['last_name'].strip(), r['common_name'].strip()
    if common:
        if first and plain(common) in plain(last) and ' ' not in common:
            return f'{first} {common}', common
        return common, common
    return f'{first} {last}'.strip(), last or first

def pick(players):
    players = sorted(players, key=lambda r: -int(r['overall_rating']))
    taken = collections.Counter()
    out = []
    for r in players:
        b = BUCKET[POS.get(r['position'], r['position'])]
        if taken[b] < QUOTA[b]:
            taken[b] += 1
            out.append(r)
    # small player pools: top up to 13 with the best of the rest
    for r in players:
        if len(out) >= 13:
            break
        if r not in out and BUCKET[POS.get(r['position'], r['position'])] != 'GK':
            out.append(r)
    return sorted(out, key=lambda r: -int(r['overall_rating']))

# one display name per player id; resolve clashes between different people
names = {}
used = {}
missing_iso = collections.Counter()
def name_of(r):
    pid = r['player_id']
    if pid in names:
        return names[pid]
    full, card = display(r)
    if full in used and used[full] != pid:
        full = f"{r['first_name']} {r['last_name']}".strip()
        if full in used and used[full] != pid:
            full = f"{full} {r['club'][:3]}"
    used[full] = pid
    names[pid] = (full, card)
    return names[pid]

def js_str(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")

def row(r, with_nat):
    full, card = name_of(r)
    pos = POS.get(r['position'], r['position'])
    nat = ISO.get(r['nationality'], '')
    if not nat:
        missing_iso[r['nationality']] += 1
    for bad in ',;':
        full, card = full.replace(bad, ' '), card.replace(bad, ' ')
    return f"{full},{pos},{r['overall_rating']},{nat if with_nat else ''},{card}"

by_club = collections.defaultdict(list)
by_nat = collections.defaultdict(list)
for r in rows:
    by_club[r['club']].append(r)
    by_nat[r['nationality']].append(r)

lines = ["// 2026/27 squads and EA SPORTS FC 27 ratings, generated from EA's official ratings data (snapshot 2026-09-12).",
         "// Club players: \"Name,POS,OVR,NATION,CARD NAME\". Nation players: \"Name,POS,OVR,,CARD NAME\".",
         "ERAS.now = {", "  label: '2026/27',", "  game: 'FC 27',", "  clubs: ["]
for ea_name, cid, disp, short, kit in CLUBS:
    squad = pick(by_club[ea_name])
    assert len(squad) >= 11, (ea_name, len(squad))
    league = LEAGUE[squad[0]['league']]
    players = ';'.join(row(r, True) for r in squad)
    lines.append(f"    {{ id: '{cid}', name: '{js_str(disp)}', short: '{short}', league: '{league}', kit: {kit},\n      players: '{js_str(players)}' }},")
lines += ["  ],", "", "  nations: ["]
for nat, nid, disp, short, code, conf, kit in NATIONS:
    squad = pick(by_nat[nat])
    assert len(squad) >= 11, (nat, len(squad))
    players = ';'.join(row(r, False) for r in squad)
    lines.append(f"    {{ id: '{nid}', name: '{disp}', short: '{short}', code: '{code}', league: '{conf}', kit: {kit},\n      players: '{js_str(players)}' }},")
lines += ["  ],", ""]

# Team of the Year: the only players with the special card design
TOTY_KEYS = ['donnarumma', 'hakimi', 'van dijk', 'saliba', 'nuno mendes', 'rodri', 'vitinha', 'pedri', 'bellingham', 'lamine yamal', 'dembele', 'mbappe', 'haaland']
toty = []
for key in TOTY_KEYS:
    cands = sorted([r for r in rows if plain(r['common_name'] or r['last_name']) == key], key=lambda r: -int(r['overall_rating']))
    assert cands, key
    toty.append(name_of(cands[0])[0])
lines.append("  // Team of the Year: the only players with the special card design")
lines.append("  toty: [" + ', '.join("'" + js_str(t) + "'" for t in toty) + "],")
lines += ["", "  comps: {", "    pl: " + str(PL).replace('"', "'") + ",", "    ucl: " + str(UCL).replace('"', "'") + ",", "  },", "};", ""]
open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
print('wrote', OUT, '| toty:', toty)
print('nationalities without a flag code:', dict(missing_iso.most_common(15)))
