import sys, json, openpyxl
src, dst, month = sys.argv[1:4]
V = json.load(open("vals.json"))[month]
wb = openpyxl.load_workbook(src); ws = wb["Indicator values"]
h = {c.value: i for i, c in enumerate(ws[1])}
n = 0
for row in ws.iter_rows(min_row=2):
    code = row[h["Code"]].value
    if code in V and str(row[h["Locked"]].value or "").lower() != "yes":
        v = V[code]; row[h["Period achievement"]].value = v["period"]
        if v["cum"] is not None: row[h["Cumulative"]].value = v["cum"]
        row[h["Data source"]].value = v["src"]; n += 1
wb.save(dst); print("filled rows", n, "of", len(V))
