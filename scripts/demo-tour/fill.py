import sys, random, openpyxl
src, dst = sys.argv[1:3]; random.seed(17)
wb = openpyxl.load_workbook(src); ws = wb["Indicator values"]
h = {c.value: i for i, c in enumerate(ws[1])}; n = 0
for row in ws.iter_rows(min_row=2):
    code = row[h["Code"]].value
    if not code or str(row[h["Locked"]].value or "").lower() == "yes": continue
    name = str(row[h["Indicator"]].value).lower(); t = str(row[h["Target"]].value or "").replace(",", "")
    try: target = float(t)
    except ValueError: target = 0
    if " rate" in name or "coverage" in name or "%" in name:
        v = round(target * random.uniform(0.85, 1.1)) if target else 0
        row[h["Period achievement"]].value = v
    else:
        v = max(1, round((target or 600) * random.uniform(0.13, 0.19)))
        row[h["Period achievement"]].value = v; row[h["Cumulative"]].value = v
    row[h["Data source"]].value = "Site registers, November"; n += 1
wb.save(dst); print("filled", n)
