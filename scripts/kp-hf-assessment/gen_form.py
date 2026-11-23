import re, json, sys
import os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out') + '/'
os.makedirs(D, exist_ok=True)

# ---- flatten the document into logical tables ------------------------------------------------
lines = open(D + 'doc.txt').read().split('\n')
rows = [l[3:].split(' | ') for l in lines if l.startswith('R: ')]
TITLE = re.compile(r'^SECTION\s*0?(\d+)\s*[:.]?\s*(.*)$', re.I)

def clean(s):
    s = s.replace('[]', '').strip()
    s = re.sub(r'\s*/\s*o\b', '', s)
    s = re.sub(r'\s+o$', '', s)
    s = re.sub(r'\s*\(attach proof if any\)', '', s)
    return s.strip(' /')

segs = []  # (sectionNo, kind, title, rows)
cur = None
for r in rows:
    first = r[0].strip()
    nonempty = [c for c in r if c.strip()]
    m = TITLE.match(first)
    if m and len(nonempty) <= 1 and not first.startswith('SECTION CONTENTS'):
        n = int(m.group(1)); t = m.group(2)
        kind = 'EQUIP' if 'EQUIPMENT' in t.upper() else 'INFRA'
        cur = dict(n=n, kind=kind, title=t, rows=[])
        segs.append(cur); continue
    if first == 'SUMMARY':
        cur = dict(n=cur['n'] if cur else 0, kind='SUMMARY', title='SUMMARY', rows=[]); segs.append(cur); continue
    if cur is not None:
        cur['rows'].append(r)

def slug(s, n=30):
    s = re.sub(r'\(.*?\)', ' ', s.lower().replace('&', ' and '))
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s[:n].strip('_') or 'x'

class Keys:
    def __init__(self): self.used = set()
    def __call__(self, base, n=36):
        base = slug(base, n); k = base; i = 2
        while k in self.used: k = f'{base[:n-3]}_{i}'; i += 1
        self.used.add(k); return k
fkey = Keys()

def opt(vs): return [{'value': slug(v, 30) or 'x', 'label': v} for v in vs]
def cond(field, v='yes'): return {'field': field, 'op': 'EQ', 'value': v}

COUNT_OPT = re.compile(r'^\d\+?$')

def parse_items(rs):
    items = []
    for r in rs:
        r = (r + [''] * 8)
        ind = r[1].strip() if len(r) > 1 else ''
        det = [clean(c) for c in r[2:6]]
        det = [c for c in det if c and c.lower() not in ('o',)]
        if ind.upper() in ('INDICATOR','INDICATORS','DESCRIPTION','ITEM'): continue
        if ind:
            items.append(dict(name=re.sub(r'\s+', ' ', ind), opts=det))
        elif det and items:
            items[-1]['opts'] += det
    return items

def classify(it):
    o = it['opts']; name = it['name']; o0 = (o[0] if o else '')
    if o and all(COUNT_OPT.match(x) for x in o): return 'COUNT'
    if re.search(r'specify\s*(number|numbers)?|numbers?:', o0, re.I) and not re.search(r'capacity|kva|date|year|area|sq', o0 + name, re.I): return 'COUNT'
    if re.search(r'capacity|kva', o0 + name, re.I): return 'NUMBER'
    if re.search(r'date/year|specify:|text field|details', o0, re.I): return 'TEXT'
    low = [x.lower() for x in o]
    if any(x.startswith('available') for x in low) and any(x.startswith('not available') for x in low): return 'AVAIL'
    if any(x.startswith('adequate') for x in low) and any(x.startswith('inadequate') for x in low): return 'ADEQ'
    if low and low[0].startswith('yes') and any(x == 'no' for x in low): return 'AVAIL'
    if len(o) >= 2: return 'SELECT'
    if not o: return 'COUNT'
    return 'TEXT'

def photo(prefix, label):
    return {'key': fkey(prefix + '_photos'), 'label': f'Photo evidence: {label} (optional)', 'type': 'FILE', 'help': 'Attach a photograph where the tool asks for photographic evidence.'}

def infra_fields(prefix, segrows, label):
    """standalone selects/numbers first, then an availability checklist grid and a counts grid."""
    items = parse_items(segrows)
    fields, avail, counts = [], [], []
    for it in items:
        k = classify(it); nm = it['name']
        if k == 'AVAIL': avail.append((nm, ''))
        elif k == 'ADEQ': avail.append((nm + ' (adequate?)', ''))
        elif k == 'COUNT': counts.append(nm)
        elif k == 'SELECT': fields.append({'key': fkey(prefix + '_' + slug(nm, 22)), 'label': nm, 'type': 'SELECT', 'options': opt([x for x in it['opts'] if x])})
        elif k == 'NUMBER': fields.append({'key': fkey(prefix + '_' + slug(nm, 22)), 'label': nm + ' (' + ('liters' if 'liter' in ' '.join(it['opts']).lower() else 'KVA' if 'kva' in (nm + ' '.join(it['opts'])).lower() else 'number') + ')', 'type': 'NUMBER', 'min': 0})
        else: fields.append({'key': fkey(prefix + '_' + slug(nm, 22)), 'label': nm, 'type': 'TEXT', 'maxLength': 500})
    out = list(fields)
    def rowsof(names):
        seen = set(); rs = []
        for nm in names:
            k = slug(nm, 36); i = 2; base = k
            while k in seen: k = f'{base[:33]}_{i}'; i += 1
            seen.add(k); rs.append({'key': k, 'label': nm[:300]})
        return rs
    if avail:
        out.append({'key': fkey(prefix + '_checklist'), 'label': f'{label}: what is available', 'type': 'GRID', 'help': 'Tick Yes where it is available (or adequate) and write what is missing in Remarks. Observe and verify, do not rely on what you are told.',
                    'rows': rowsof([a[0] for a in avail][:120]),
                    'columns': [{'key': 'available', 'label': 'Available / adequate?', 'type': 'YES_NO'}, {'key': 'remarks', 'label': 'Remarks (what is missing)', 'type': 'TEXT'}]})
    if counts:
        out.append({'key': fkey(prefix + '_counts'), 'label': f'{label}: how many', 'type': 'GRID', 'help': 'Enter 0 where there is none. Functional and non-functional should add up to the number available.',
                    'rows': rowsof(counts[:120]),
                    'columns': [{'key': 'number', 'label': 'Number available', 'type': 'NUMBER', 'min': 0}, {'key': 'functional', 'label': 'Functional', 'type': 'NUMBER', 'min': 0}, {'key': 'nonfunctional', 'label': 'Non-functional', 'type': 'NUMBER', 'min': 0}, {'key': 'remarks', 'label': 'Remarks', 'type': 'TEXT'}]})
    return out

def equip_field(prefix, segrows, label):
    names = []
    for r in segrows:
        r = r + [''] * 3
        nm = r[1].strip()
        if nm and nm.lower() != 'item' and not nm.startswith('SECTION'): names.append(re.sub(r'\s+', ' ', nm))
    seen = set(); rs = []
    for nm in names:
        k = slug(nm, 36); i = 2; base = k
        while k in seen: k = f'{base[:33]}_{i}'; i += 1
        seen.add(k); rs.append({'key': k, 'label': nm[:300]})
    if not rs: return None
    assert len(rs) <= 120, (prefix, len(rs))
    return {'key': fkey(prefix + '_equipment'), 'label': f'{label}: equipment', 'type': 'GRID', 'help': 'Quantity found, how many work, and how many do not. Leave a row empty if the item is not there. Purchase and installation dates can be a year.',
            'rows': rs,
            'columns': [{'key': 'quantity', 'label': 'Quantity', 'type': 'NUMBER', 'min': 0}, {'key': 'functional', 'label': 'Functional', 'type': 'NUMBER', 'min': 0}, {'key': 'nonfunctional', 'label': 'Non-functional', 'type': 'NUMBER', 'min': 0},
                        {'key': 'make_model', 'label': 'Model and make', 'type': 'TEXT'}, {'key': 'purchase', 'label': 'Purchase date / year', 'type': 'TEXT'}, {'key': 'installation', 'label': 'Installation date / year', 'type': 'TEXT'}, {'key': 'remarks', 'label': 'Remarks', 'type': 'TEXT'}]}

def section(key, title, help=None, when=None):
    f = {'key': key, 'label': title, 'type': 'SECTION'}
    if help: f['help'] = help
    if when: f['relevantWhen'] = when
    return f

def yn(key, label, **kw): return dict(key=key, label=label, type='YES_NO', **kw)
def txt(key, label, **kw): return dict(key=key, label=label, type='TEXT', maxLength=kw.pop('maxLength', 300), **kw)
def num(key, label, **kw): return dict(key=key, label=label, type='NUMBER', min=kw.pop('min', 0), **kw)
def sel(key, label, vs, **kw): return dict(key=key, label=label, type='SELECT', options=opt(vs), **kw)
def grid(key, label, rowl, cols, **kw): return dict(key=key, label=label, type='GRID', rows=[{'key': slug(r, 36), 'label': r} for r in rowl], columns=cols, **kw)
def yrs(): return [{'key': f'y{y}', 'label': str(y), 'type': 'NUMBER', 'min': 0} for y in (2022, 2023, 2024)]
for k in ['assessment_date', 'ms_name', 'ms_phone', 'dho_name', 'dho_phone']: fkey.used.add(k)

F = []
# ---- assessment details
F += [section('sec_details', 'Assessment details', 'Complete every section. If something does not apply, mark it not applicable or write N/A. Use observation and records, and attach photos where the tool asks.'),
      {'key': 'assessment_date', 'label': 'Date of assessment', 'type': 'DATE', 'required': True},
      txt('ms_name', 'Name of Medical Superintendent (MS) / Facility In-Charge', required=True),
      txt('ms_phone', 'Contact number of Medical Superintendent (MS) / Facility In-Charge', maxLength=30),
      txt('dho_name', 'Name of concerned District Health Officer (DHO)'),
      txt('dho_phone', 'Contact number of concerned District Health Officer (DHO)', maxLength=30)]
# ---- Section 1
F += [section('sec1', 'Section 1: General overview'),
      txt('s1_ddo_code', 'Facility DDO code', maxLength=40), txt('s1_dhis_code', 'Facility DHIS code', maxLength=40),
      sel('s1_level', 'Facility level', ['Primary', 'Secondary', 'Specialized']),
      sel('s1_type', 'Facility type', ['Category-A', 'Category-B', 'Category-C', 'Category-D', 'Rural Health Centre (RHC)']),
      num('s1_year_est', 'Year of establishment', min=1800, max=2030), num('s1_catchment', 'Catchment population'),
      txt('s1_district', 'District'), txt('s1_tehsil', 'Tehsil / UC'), txt('s1_village', 'City / village'),
      {'key': 's1_gps', 'label': 'GPS coordinates of the facility (stand at the main gate)', 'type': 'GPS'},
      sel('s1_road', 'Accessibility: condition of the main road', ['Asphalt', 'PCC', 'Kachha', 'Other']),
      txt('s1_referral', 'Nearest referral facility (name)'), num('s1_referral_km', 'Nearest referral facility: distance (km)'),
      num('s1_beds_sanctioned', 'Sanctioned beds'), num('s1_beds_functional', 'Functional beds'),
      grid('s1_annual', 'Annual figures', ['Annual OPD attendance', 'Annual emergency attendance', 'Annual indoor admissions', 'Bed occupancy rate (%)', 'Annual lab utilization', 'Annual X-ray utilization', 'Annual deliveries (live births)', 'Annual major surgeries'], yrs(), help='From the facility registers. Leave a year empty if there is no record.'),
      num('s1_ambulances', 'Number of ambulances available'),
      yn('s1_hcc', 'Registered with the Health Care Commission?'), txt('s1_nonrelated', 'Non-related people within the hospital premises: occupied areas and description of the people living there', maxLength=1500),
      section('sec1b', 'Section 1: Financial assessment (FY 2024-25)'),
      num('s1_budget', 'Annual budget allocation 2024-25 (PKR)'),
      grid('s1_budget_src', 'Budget source (PKR)', ['Provincial Govt.', 'PCMC', 'HMC'], [{'key': 'amount', 'label': 'Amount (PKR)', 'type': 'NUMBER', 'min': 0}]),
      yn('s1_sehat', 'Empanelled with Sehat Sahulat Card (SHPI)?'),
      num('s1_utilised', 'Budget utilization 2024-25 (PKR)'), num('s1_salary', 'Salary and HR expenditure (PKR)'), num('s1_om', 'Operations and maintenance expenditure (PKR)'),
      txt('s1_dev_details', 'Under development (expansion, construction of a new building): details', maxLength=1000), num('s1_dev_pkr', 'Under development: amount (PKR)'),
      grid('s1_revenue', 'Hospital-generated revenue (user fees, diagnostics, lab, OPD, ER, pharmacy), PKR', ['Revenue generated (PKR)'], yrs()),
      yn('s1_donor', 'Donor funding support available?'), txt('s1_donor_type', 'Donor funding: type', relevantWhen=cond('s1_donor')), num('s1_donor_pkr', 'Donor funding: amount (PKR)', relevantWhen=cond('s1_donor')),
      yn('s1_outsourced', 'Outsourced service contracts (lab, radiology, waste, security, etc.)?'), txt('s1_outsourced_what', 'Outsourced services: specify', relevantWhen=cond('s1_outsourced'), maxLength=500), num('s1_outsourced_pkr', 'Outsourced services: amount (PKR)', relevantWhen=cond('s1_outsourced')),
      yn('s1_audit', 'Audit reports (internal / external) available?'), {'key': 's1_audit_file', 'label': 'Attach the audit report', 'type': 'FILE', 'relevantWhen': cond('s1_audit')}]
for f in F:
    if 'relevantWhen' in f and isinstance(f['relevantWhen'], dict): pass
# ---- Section 2
F += [section('sec2', 'Section 2: Infrastructure: hospital building general information',
              'Rate each block: Good = fully functional, safe and adequate, only routine maintenance. Average = functional with moderate deficiencies, needs repairs. Poor = unsafe or inadequate, major repair or replacement needed.'),
      {'key': 's2_blocks', 'label': 'Hospital blocks', 'type': 'REPEAT', 'rowLabel': 'Block', 'maxRows': 40, 'help': 'Add one row per block (Administration, OPD, Emergency, IPD, Residential, etc.).',
       'fields': [txt('block_name', 'Block name', required=True), sel('storeys', 'Number of storeys', ['1', '2', '3', '4']), num('area_sqft', 'Covered area (sq. ft.)'), num('year', 'Year of construction / last renovation', min=1800, max=2030),
                  sel('masonry', 'Masonry type', ['Fabricated', 'Concrete blocks', 'Container / other', 'Mixed']), sel('roof', 'Roof construction', ['RCC', 'Metal', 'Tiles', 'Fabricated']),
                  sel('condition', 'Structural condition', ['Good', 'Fair', 'Poor']), txt('remarks', 'Remarks', maxLength=500)]}]
# ---- departments present
GATES = [('lab', 'Laboratory'), ('rad', 'Imaging and radiology'), ('w_med', 'Medical ward'), ('w_surg', 'Surgical ward'), ('w_gyn', 'Gynae ward'), ('w_paed', 'Paediatric ward'), ('w_other', 'Another ward'),
         ('labor', 'Labour room'), ('ot', 'Operation theatre'), ('icu', 'ICU / CCU / HDU'), ('dental', 'Dental unit'), ('resid', 'Staff residences / flats')]
F += [section('sec_present', 'Which departments does this facility have?', 'Answer No for a department that does not exist: its section is skipped.')]
for k, nm in GATES: F.append(yn('has_' + k, f'Does the facility have: {nm}?'))

# ---- departments
def seg_for(n, kind, contains=None):
    out = []
    for s in segs:
        if s['n'] == n and s['kind'] == kind and (contains is None or contains.lower() in s['title'].lower()): out.append(s)
    return out

def dept(n, key, title, gate=None, infra_contains=None, label=None, with_summary=True):
    label = label or title
    when = cond('has_' + gate) if gate else None
    out = [section(f'sec{n}_{key}', f'Section {n}: {title}', None, when)]
    ins = seg_for(n, 'INFRA', infra_contains)
    for s in ins:
        sub = re.search(r'\(([^()]*)\)\s*$', s['title']) if len(ins) > 1 else None
        out += infra_fields(f's{n}{key}', s['rows'], (sub.group(1).capitalize() if sub else label))
    eq = seg_for(n, 'EQUIP', infra_contains)
    for s in eq:
        e = equip_field(f's{n}{key}', s['rows'], label)
        if e: out.append(e)
    if with_summary:
        out += [num(fkey(f's{n}{key}_rooms'), f'{label}: total rooms'), num(fkey(f's{n}{key}_washrooms'), f'{label}: total washrooms / toilets')]
    out.append(photo(f's{n}{key}', label))
    if when:
        for f in out[1:]: f.setdefault('relevantWhen', when)
    return out

F += dept(3, 'admin', 'Administration')
F += dept(4, 'ae', 'Accident and emergency')
F += dept(5, 'lab', 'Laboratory assessment', 'lab')
F += dept(6, 'rad', 'Imaging and radiology', 'rad')
for key, nm, gate in [('MEDICAL', 'Medical ward', 'w_med'), ('SURGICAL', 'Surgical ward', 'w_surg'), ('GYNAE', 'Gynae ward', 'w_gyn'), ('PEADS', 'Paediatric ward', 'w_paed'), ('_______', 'Another ward', 'w_other')]:
    out = dept(7, 'w' + gate[2:], nm, gate, key, nm)
    if gate == 'w_other': out.insert(1, dict(txt('s7_other_name', 'Name of this ward'), relevantWhen=cond('has_w_other')))
    out[0]['label'] = f'Section 7: Wards: {nm}'
    F += out
F += dept(8, 'opd', 'Out-patient department')
F += dept(9, 'labor', 'Labour room', 'labor')
F += dept(10, 'ot', 'Operation theatre', 'ot')
F += dept(11, 'icu', 'ICU / CCU / HDU', 'icu')
F += dept(12, 'dental', 'Dental unit', 'dental')
F += dept(13, 'vert', 'Vertical programs', with_summary=False)
F += dept(14, 'pharm', 'Pharmacy / dispensary', with_summary=False)
F += dept(15, 'ext', 'Facility external / developmental works', with_summary=False)
F += dept(16, 'wash', 'Facility services: water supply and sanitation', with_summary=False)
F += dept(17, 'power', 'Facility services: electricity and gas supply', with_summary=False)
F += dept(18, 'waste', 'Hospital waste disposal', with_summary=False)
F += dept(19, 'expand', 'Facility expansion', with_summary=False)
F += dept(20, 'resid', 'Residential building assessment (flats / residences for staff)', 'resid', with_summary=False)

# ---- Section 21 EPHS checklist
q = []; lastn = ''; sub = 0
for s in segs:
    if s['n'] == 21:
        for r in s['rows']:
            r = r + [''] * 4; sn = r[0].strip(); d = re.sub(r'\s+', ' ', r[1].strip())
            if not d or d.lower() in ('description',) or d.startswith('CHECK LIST'): continue
            if sn.isdigit(): lastn = sn; sub = 0; q.append((f'{sn}. {d}', f'q{sn}'))
            else: sub += 1; q.append((f'{lastn}{chr(96 + sub)}. {d}', f'q{lastn}{chr(96 + sub)}'))
F += [section('sec21', 'Section 21: Checklist (EPHS infrastructure standards)'),
      {'key': 's21_ephs', 'label': 'Checklist as per EPHS infrastructure standards', 'type': 'GRID', 'rows': [{'key': k, 'label': t[:300]} for t, k in q],
       'columns': [{'key': 'answer', 'label': 'Answer', 'type': 'SELECT', 'options': [{'value': 'yes', 'label': 'Yes'}, {'value': 'no', 'label': 'No'}, {'value': 'na', 'label': 'N/A'}]}, {'key': 'number', 'label': 'Number, where applicable', 'type': 'NUMBER', 'min': 0}]}]

# ---- Section 22 interventions
rhc = []; cat = ''
for s in segs:
    if s['n'] == 22 and 'FACILITY LEVEL' not in s['title'].upper() and 'INTERVENTIONS' in s['title'].upper():
        pass
sec22 = [s for s in segs if s['n'] == 22]
rhc_rows = []; hosp_rows = []
for s in sec22:
    for r in s['rows']:
        r = r + [''] * 4
        if 'FACILITY LEVEL' in s['title'].upper():
            if r[0].strip().isdigit(): hosp_rows.append((f"{r[0].strip()}. {r[1].strip()}", f"h{r[0].strip()}"))
        else:
            c = r[0].strip(); i = r[1].strip()
            if c and c != 'CATEGORY' and not c.startswith('RHC'): cat = re.sub(r'^\d+\.\s*', '', c)
            if i and c != 'CATEGORY' and not (c.startswith('RHC')): rhc_rows.append((f'{cat}: {i}', f'r{len(rhc_rows) + 1}'))
print('rhc', len(rhc_rows), 'hosp', len(hosp_rows), file=sys.stderr)
yncols = [{'key': 'available', 'label': 'Available?', 'type': 'YES_NO'}]
F += [section('sec22', 'Section 22: Interventions'),
      {'key': 's22_rhc', 'label': 'RHC-level interventions: is the intervention provided?', 'type': 'GRID', 'rows': [{'key': k, 'label': t[:300]} for t, k in rhc_rows], 'columns': yncols},
      {'key': 's22_hosp', 'label': 'Facility-level hospital interventions: is the intervention provided?', 'type': 'GRID', 'rows': [{'key': k, 'label': t[:300]} for t, k in hosp_rows], 'columns': yncols}]

# ---- Section 23 service delivery
sd = []; helps = []
for s in segs:
    if s['n'] == 23:
        for r in s['rows']:
            r = r + [''] * 3; nm = r[1].strip()
            if nm and nm.lower() not in ('indicators',) and not r[0].startswith('SR'):
                sd.append(nm); helps.append(f'{nm}: {r[2].strip()}')
sd = [x for x in sd]
rows23 = []
seen = set()
for nm in sd:
    k = slug(nm, 36)
    if k in seen: continue
    seen.add(k); rows23.append(nm)
F += [section('sec23', 'Section 23: Service delivery'),
      {'key': 's23_note', 'label': 'How each figure is calculated', 'type': 'NOTE', 'help': '\n'.join(helps)[:3900]},
      {'key': 's23_services', 'label': 'Service delivery indicators', 'type': 'GRID', 'rows': [{'key': slug(n, 36), 'label': n} for n in rows23],
       'columns': yrs(), 'help': 'Enter the figure for each year from the registers. Percentages as 0-100 numbers.'}]

# ---- Section 24 HR
cats = ['Management staff', 'Specialists', 'Medical officers', 'Nursing staff', 'Paramedics', 'Class-IV / support']
F += [section('sec24', 'Section 24: Human resource assessment'),
      grid('s24_posts', 'Posts by category (from the budget book)', cats, [{'key': 'sanctioned', 'label': 'Sanctioned posts', 'type': 'NUMBER', 'min': 0}, {'key': 'regular', 'label': 'Filled by Govt (regular)', 'type': 'NUMBER', 'min': 0}, {'key': 'contract', 'label': 'Filled by Govt (contractual)', 'type': 'NUMBER', 'min': 0}, {'key': 'aip', 'label': 'Filled by Govt (AIP)', 'type': 'NUMBER', 'min': 0}]),
      {'key': 's24_staff', 'label': 'Staff list', 'type': 'REPEAT', 'rowLabel': 'Staff member', 'maxRows': 100, 'help': 'Add one row per person, under the right category. Verify the person is physically present.',
       'fields': [sel('category', 'Category', cats, required=True), txt('name', 'Name', required=True), txt('designation', 'Designation'), txt('personnel_no', 'Personnel number', maxLength=40),
                  yn('detailed_in', 'Detailed IN to this facility on general duty?'), yn('detailed_out', 'Detailed OUT of this facility on general duty?'), txt('reg_no', 'PMDC / CPSP / PNC / HEC / medical faculty number', maxLength=60),
                  {'key': 'joining', 'label': 'Joining date (hospital)', 'type': 'DATE'}, num('gross_pay', 'Gross pay (any month from Jan 2025 to date, PKR)'), yn('verified', 'Staff verified and physically available?'), txt('remarks', 'Remarks', maxLength=500)]},
      section('sec_sign', 'Sign-off'),
      {'key': 'sig_ms', 'label': 'Signature of Medical Superintendent (with stamp)', 'type': 'SIGNATURE', 'signer': 'Medical Superintendent'},
      {'key': 'sig_dho', 'label': 'Signature of District Health Officer (with stamp)', 'type': 'SIGNATURE', 'signer': 'District Health Officer'},
      {'key': 'sig_assessor', 'label': 'Assessor remarks on the visit', 'type': 'TEXT', 'maxLength': 2000}]

for f in F:
    if f.get('rows'):
        seen = set()
        for r in f['rows']:
            k = r['key'] if re.match(r'^[a-z]', r['key']) else ('r_' + r['key'])[:40]
            b = k; i = 2
            while k in seen: k = f'{b[:37]}_{i}'; i += 1
            seen.add(k); r['key'] = k
json.dump(F, open(D + 'fields.json', 'w'), indent=1)
def count(fs): return sum(1 + count(f.get('fields', [])) for f in fs)
print('top-level fields', len(F), 'sections', sum(1 for f in F if f['type'] == 'SECTION'), 'grids', sum(1 for f in F if f['type'] == 'GRID'), 'gridrows', sum(len(f.get('rows', [])) for f in F), file=sys.stderr)
keys = [f['key'] for f in F]
assert len(keys) == len(set(keys)), [k for k in keys if keys.count(k) > 1]
assert all(len(k) <= 40 for k in keys)
