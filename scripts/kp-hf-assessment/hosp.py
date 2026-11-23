import csv, json, datetime
# (no, district, facility name as in the list, level key, date start, date end)
H = [
(1,'Buner','Cat-D Hospital Pacha Kallay','CAT_D','2026-11-27','2026-11-27'),
(2,'D.I. Khan','Cat-D Hospital Kulachi','CAT_D','2026-12-08','2026-12-08'),
(3,'Dir Lower','Cat-B Hospital Chakdara','CAT_B','2026-11-30','2026-11-30'),
(4,'Dir Lower','Cat-D Hospital Mayar','CAT_D','2026-11-30','2026-11-30'),
(5,'Dir Upper','Cat-D Hospital Patrak','CAT_D','2026-11-30','2026-11-30'),
(6,'Hangu','Cat-D Hospital Doaba Hangu','CAT_D','2026-12-02','2026-12-02'),
(7,'Hangu','Cat-D Hospital Thall','CAT_D','2026-12-02','2026-12-02'),
(8,'Haripur','Cat-D Hospital Kanpur','CAT_D','2026-12-01','2026-12-01'),
(9,'Karak','Cat-D Hospital Latamber','CAT_D','2026-12-04','2026-12-04'),
(10,'Karak','Cat-D Hospital Sabir Abad','CAT_D','2026-12-04','2026-12-04'),
(11,'Karak','Cat-C Hospital Thathi Nasrathi','CAT_C','2026-12-04','2026-12-04'),
(12,'Kohat','Cat-D Hospital Lachi','CAT_D','2026-12-02','2026-12-02'),
(13,'Kurram','THQ Hospital Sadda (Cat-C)','CAT_C','2026-12-03','2026-12-03'),
(14,'Lakki Marwat','Cat-C Hospital Lakki Marwat','CAT_C','2026-12-07','2026-12-07'),
(15,'Lakki Marwat','Cat-D Hospital Titter Khel','CAT_D','2026-12-07','2026-12-07'),
(16,'Lakki Marwat','Cat-C Hospital Serai Naurang','CAT_C','2026-12-07','2026-12-07'),
(17,'Lakki Marwat','DHQ Hospital Lakki Marwat (Cat-B)','CAT_B','2026-12-07','2026-12-07'),
(18,'Lakki Marwat','RHC Landiwah','RHC','2026-12-07','2026-12-07'),
(19,'Mahsud Belt - SW','MHF (RHC) Tiarza','RHC','2026-12-07','2026-12-08'),
(20,'Malakand','Cat-D Hospital Totakan','CAT_D','2026-11-27','2026-11-27'),
(21,'Mansehra','Cat-D Hospital Oghi','CAT_D','2026-12-01','2026-12-01'),
(22,'Mardan','Cat-D Hospital Katlung','CAT_D','2026-11-26','2026-11-26'),
(23,'Mardan','Cat-D Hospital Rustam','CAT_D','2026-11-26','2026-11-26'),
(24,'Mardan','Cat-D Hospital Shahbaz Garhi','CAT_D','2026-11-26','2026-11-26'),
(25,'Mardan','Cat-D Hospital Toru','CAT_D','2026-11-26','2026-11-26'),
(26,'Mohmand','DHQ (Cat-C) Hospital Ghallanai','CAT_C','2026-12-04','2026-12-04'),
(27,'North Waziristan','Civil Hospital Datta Khel','CIVIL','2026-12-07','2026-12-08'),
(28,'North Waziristan','RHC Spinwam','RHC','2026-12-07','2026-12-08'),
(29,'Nowshera','Cat-D Hospital Ziarat Kaka Sahib','CAT_D','2026-11-25','2026-11-25'),
(30,'Nowshera','Cat-D Hospital Manki Sharif','CAT_D','2026-11-25','2026-11-25'),
(31,'Orakzai','Cat-D Hospital Daboori','CAT_D','2026-12-03','2026-12-03'),
(32,'Orakzai','Cat-D Hospital Kalaya','CAT_D','2026-12-03','2026-12-03'),
(33,'Peshawar','Cat-D Hospital Mathani','CAT_D','2026-11-25','2026-11-25'),
(34,'Shangla','Cat-D Hospital Besham','CAT_D','2026-12-01','2026-12-01'),
(35,'Shangla','Cat-C Hospital Puran','CAT_C','2026-12-01','2026-12-01'),
(36,'Swat','Cat-C Hospital Madyan','CAT_C','2026-11-27','2026-11-27'),
(37,'Swat','Cat-D Hospital Manglore','CAT_D','2026-11-27','2026-11-27'),
]
assert len(H)==37 and len({h[2] for h in H})==37
def q(s): return '"'+s.replace('"','""')+'"' if (',' in s or '"' in s) else s
import os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'out')+'/'
os.makedirs(D,exist_ok=True)
# places
P=['Name,Level,Parent,Code,Latitude,Longitude,Other spellings,Facility type','Pakistan,Country,,,,,,','K.P.,State or province,Pakistan,,,,Khyber Pakhtunkhwa; KP; KPK,']
seen=[]
for h in H:
    if h[1] not in seen: seen.append(h[1]); P.append(f'{q(h[1])},District or locality,K.P.,,,,,')
for h in H: P.append(f'{q(h[2])},Community or site,{q(h[1])},,,,,{h[3]}')
open(D+'places.csv','w').write('\n'.join(P)+'\n')
# logframe
L=['Level,Code,Title',
'GOAL,G,"The present status and condition of 37 health facilities in Khyber Pakhtunkhwa is established so that investment and rehabilitation decisions can be made on evidence"',
'OUTCOME,OC1,"A complete and verified baseline on the infrastructure, equipment, utilities, services and human resources of 37 health facilities is available to the Khyber Pakhtunkhwa Health Foundation"',
'OUTPUT,1.1,"Detailed assessments of 37 health facilities are completed in 21 districts using the Health Facility Assessment Tool (Nov 2025 version)"',
'ACTIVITY,A1.1.1,"Prepare the assessment: pre-test the tool and mobile form, train assessors and arrange access to the facilities"',
'ACTIVITY,A1.1.2,"Assess each facility in person with the Health Facility Assessment Tool, by observation and record check, and have the Medical Superintendent and DHO sign"',
'OUTPUT,1.2,"Assessment data is checked, consolidated and reported"',
'ACTIVITY,A1.2.1,"Review and verify the submitted assessments and correct gaps with the assessors"',
'ACTIVITY,A1.2.2,"Prepare the consolidated status and condition report for the 37 facilities"']
open(D+'logframe.csv','w').write('\n'.join(L)+'\n')
I=['Code,Indicator,Type,Baseline,Target,Unit,Frequency,Disaggregation,Logframe Code,Means of Verification,Better when',
'OC1-1,Health facilities with a completed detailed assessment,NUMBER,0,37,facilities,Monthly,,OC1,Submitted assessment forms,Higher',
'OC1-2,Completed assessments signed by the Medical Superintendent and the DHO,NUMBER,0,37,assessments,Monthly,,OC1,Signatures in the assessment form,Higher',
'1.1-1,Facilities visited and assessed with the assessment tool,NUMBER,0,37,facilities,Monthly,,1.1,Assessment form records and visit dates,Higher',
'1.1-2,Districts with at least one facility assessed,NUMBER,0,21,districts,Monthly,,1.1,Assessment form records,Higher',
'1.2-1,Assessments verified by the review team,NUMBER,0,37,assessments,Monthly,,1.2,Review log,Higher',
'1.2-2,Consolidated status and condition report completed,NUMBER,0,1,reports,Monthly,,1.2,The report,Higher']
open(D+'indicators.csv','w').write('\n'.join(I)+'\n')
# work plan
W=['Logframe Code,Title,Start,End,Lead email,Location,Repeats',
'A1.1.1,Pre-test the assessment tool and mobile form on one facility and agree the visit schedule,2026-11-23,2026-11-23,,Peshawar,',
'A1.1.1,Train the assessors on the tool and the mobile form and arrange access letters,2026-11-24,2026-11-24,,Peshawar,']
for h in H:
    W.append(f'A1.1.2,{q("Assess "+h[2]+" ("+h[1]+")")},{h[4]},{h[5]},,{q(h[2])},')
W+=['A1.2.1,Review and verify the submitted assessments,2026-12-09,2026-12-10,,Peshawar,',
'A1.2.2,Prepare the consolidated status and condition report,2026-12-09,2026-12-11,,Peshawar,']
open(D+'workplan.csv','w').write('\n'.join(W)+'\n')
print(len(W)-1,'plan rows;',len(seen),'districts')
