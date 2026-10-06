export const MONTHS = ["March","April","May","June","July","August"];
export const D = {
  "1.1": [2,4,5,5,4,4], "O1": [900,1800,2600,3000,2900,2800], "1.3": [58,63,70,78,84,91],
  "1.2": [1,2,3,2,2,2], "2.1": [20,45,60,60,60,55], "2.2": [0,1,1,2,1,1],
  "2.3": [1200,1800,2400,2400,2200,2000], "O2": [32,38,47,58,67,76],
};
export const RATE = new Set(["1.3","O2"]);
export const cum = (c, m) => RATE.has(c) ? D[c][m] : D[c].slice(0, m + 1).reduce((a, b) => a + b, 0);
export const NOTES = {
 "1.1": ["Two hand pumps at Johi cleared and fitted","Four pumps and one solar scheme restored","Five water points completed; one delayed by flooding","Five water points handed over","Four water points; spare parts delayed one site","Final four water points completed and handed over"],
 "O1": ["Registered users at first two water points","Users counted from household registers","Includes new users at Mehar","","Late registrations at Johi added","Final reconciliation of household registers"],
 "1.3": ["28 of 48 samples met standard","Chlorination started at all sites","Chlorine dosing training effective","","Samples tested weekly","91% of 120 samples met the standard"],
 "1.2": ["First committee formed at Johi","","","","","Final committees trained and registered"],
 "2.1": ["Slow start: materials delayed","","","","","Final latrines completed"],
 "2.2": ["Site selection and designs only","First school block handed over","","","","Final school block handed over"],
 "2.3": ["","","","","","Includes school sessions"],
 "O2": ["Baseline spot-check 28%","","","","","Endline spot-check"],
};

export const FEMALE = { "O1": 0.55, "2.3": 0.54 };
export const split = (v, sh) => { const f = Math.round(v * sh); return [f, v - f]; };
