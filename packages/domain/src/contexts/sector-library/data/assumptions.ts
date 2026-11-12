import type { LibrarySectorId, LogframeSkeletonNode } from "../model.js";

/**
 * A starting assumption under each suggested outcome and output (Phase 52): what must hold for that result to lead to the one above it.
 * Written as plain conditions a team can keep, change or delete. Like every library text it starts UNREVIEWED: a person confirms each
 * one for their own context before it goes to a donor. Keyed by sector and node key; merged into the skeleton by `withAssumptions`.
 */
export const SKELETON_ASSUMPTIONS: Readonly<Record<LibrarySectorId, Readonly<Record<string, string>>>> = {
  PROTECTION_AAP: {
    "o-acc": "People know the channels exist, trust them and are not afraid of reprisal for using them.",
    "out-mech": "Staff have time and authority to answer feedback, and referrals reach services that can act.",
  },
  MEAL: {
    "o-data": "Managers read the data and have the time and authority to change the programme because of it.",
    "out-sys": "Staff are trained to use the tools and field teams can reach people and sites to collect data.",
  },
  FINANCE_GRANTS: {
    "o-fin": "Procurement, payment and approval rules are followed, and donor budget rules stay as agreed.",
    "out-rep": "Partners send complete supporting documents on time and finance staff stay in post.",
  },
  SAFEGUARDING: {
    "o-safe": "People trust the reporting routes and management acts on every concern raised.",
    "out-train": "Staff and partners attend, and turnover does not erase the training before it is used.",
  },
  CLIMATE_DRR: {
    "o-prep": "Warnings are received in time, understood and acted on, and people are able to move or protect assets.",
    "o-adapt": "Weather and markets stay within the range the new practices were designed for.",
    "out-plan": "Local authorities and communities keep the plans and warning systems running after support ends.",
    "out-works": "Materials and labour are available, land use is agreed and works are maintained.",
  },
  ENVIRONMENT_ENERGY: {
    "o-energy": "Households can afford fuel or repairs and prefer the new energy source to the old.",
    "out-install": "Supply chains for parts and technicians continue, and users operate the systems as designed.",
  },
  INFRASTRUCTURE: {
    "o-access": "Roads and facilities stay open and safe, and services and markets are available at the other end.",
    "out-works": "Contractors are available, access and security allow building, and land and permit issues are settled.",
  },
  ECONOMIC_DEVELOPMENT: {
    "o-jobs": "Markets and demand grow enough for enterprises to hire, and the wider economy does not worsen sharply.",
    "out-supp": "Enterprises want and can use the support, and finance partners lend on the agreed terms.",
  },
  SOCIAL_PROTECTION: {
    "o-cov": "The state or funder keeps the programme funded, and eligible households can register and are not excluded.",
    "out-sys": "Government counterparts stay in post and adopt the improved systems.",
  },
  GOVERNANCE: {
    "o-acc": "Officials are willing to listen and respond, and citizens can take part safely.",
    "out-cso": "Civil society groups have enough civic space to operate and keep their members and funding.",
  },
  PEACEBUILDING: {
    "o-trust": "No major new violence or political shock reverses progress, and leaders do not block contact between groups.",
    "out-dial": "All groups are willing to attend, participants can travel safely, and agreements are respected.",
  },
  EDUCATION: {
    "o-access": "Families can afford to send children, the routes and spaces are safe, and no new displacement or closure occurs.",
    "o-learn": "Children attend often enough, teachers stay, and the curriculum and language suit the learners.",
    "out-spaces": "Land, materials and permissions are available and the spaces are maintained and not taken over for other use.",
    "out-teach": "Trained teachers stay in the schools, are paid and are supported by the education authority.",
  },
  FOOD_SECURITY: {
    "o-food": "Food is available in local markets at prices households can afford, and assistance reaches those who need it.",
    "o-live": "Weather, pests and market prices stay within a range where production and income recover.",
    "out-dist": "Targeting is accepted by the community, supply chains and security allow delivery, and cash or food is not diverted.",
    "out-inputs": "Inputs arrive before the season, are of good quality, and households use them as trained.",
  },
  HEALTH: {
    "o-access": "People can reach facilities safely, can afford any costs, and trust the services enough to use them.",
    "o-system": "The ministry, staff pay and supply chains continue, and funding gaps do not close facilities.",
    "out-mnch": "Skilled staff are present and equipped, and families allow women and children to use the services.",
    "out-disease": "Surveillance data is reported on time, vaccines keep cold chain and communities accept vaccination and referral.",
    "out-staff": "Trained health workers stay at their posts and supervisors visit as planned.",
    "out-supplies": "Procurement and transport run on time, storage is safe and stock is not diverted.",
  },
  GENDER_EQUALITY: {
    "o-voice": "Family and community leaders allow women and girls to take part, and no backlash makes participation unsafe.",
    "out-act": "Participants attend regularly, and men, boys and leaders take part in discussions on norms.",
  },
  DISABILITY_INCLUSION: {
    "o-access": "Providers use the accessible formats and facilities, and people with disabilities know about and can reach them.",
    "out-adapt": "Devices and adaptations are used and maintained, and repair and replacement are available.",
  },
  MIGRATION_DISPLACEMENT: {
    "o-prot": "Authorities keep issuing documents and respecting rights, and people can reach the offices safely.",
    "o-sol": "Conditions in the place of return, integration or resettlement allow durable solutions, and policy does not change against it.",
    "out-reg": "People come forward to register and trust how their information will be used.",
    "out-sol": "Housing, jobs and services are available where people settle, and the host community accepts them.",
  },
  MHPSS: {
    "o-support": "People seek help without stigma, and referral services are available when a need goes beyond what the community can give.",
    "out-comm": "Facilitators are trained, supervised and stay, and families and community leaders accept the activities.",
    "out-spec": "Qualified specialists and referral pathways exist and are reachable by those who need them.",
  },
  LOCALISATION: {
    "o-cap": "Funders pass funds and decision-making to local partners, and local partners can retain trained staff.",
    "out-cap": "Partner leaders commit time to the capacity plans, and the plans match what the partner wants to change.",
  },
  EARLY_RECOVERY: {
    "o-income": "Markets recover enough to absorb the work and enterprises, and security allows people to work.",
    "out-skills": "Trained people find placements, and employers or markets exist for the skills taught.",
    "out-works": "Work is available when people need it, pay arrives on time, and the works are useful and safe.",
  },
  CASH: {
    "o-needs": "Markets have the goods people need at stable prices, and households decide freely how to spend.",
    "out-pay": "The payment provider is reliable, recipients can collect safely, and the transfer value stays enough for the need.",
  },
  AGRICULTURE: {
    "o-prod": "Rains, pests and prices stay within a normal range, and farmers can reach a market to sell.",
    "out-inputs": "Inputs and services arrive on time and suit local conditions.",
    "out-train": "Farmers attend, can afford to apply what they learn, and have the land and water to use it.",
  },
  NUTRITION: {
    "o-treat": "Caregivers bring children for treatment and stay to complete it, and no food or health shock overwhelms the sites.",
    "o-feed": "Households have access to suitable food and time to feed children as advised, and family members support the practices.",
    "out-screen": "Caregivers accept screening, and referral sites are reachable and able to take the children referred.",
    "out-treat": "Therapeutic food and medicines arrive without breaks, and trained staff stay in post.",
    "out-iycf": "Counsellors are trained and supervised, and caregivers have the time and support to attend.",
  },
  CCCM: {
    "o-man": "Residents and the authorities agree on site rules, and the site is not closed or moved without notice.",
    "out-struct": "Residents elect or accept their representatives, and committees include women and marginalised groups.",
  },
  LOGISTICS: {
    "o-serv": "Partners know the service exists and request it, and routes and customs allow cargo to move.",
    "out-move": "Vehicles, storage and fuel are available, and roads and permits stay open.",
  },
  TELECOMS: {
    "o-comm": "Responders use the shared services and the authorities permit the equipment and frequencies.",
    "out-set": "Power and spare parts are available, and technicians can reach the sites.",
  },
  COORDINATION: {
    "o-coord": "Partners share information openly and attend, and members act on decisions taken together.",
    "out-3w": "Partners report on time and in the agreed format, and staff to maintain the information stay in post.",
  },
  HLP: {
    "o-secure": "Authorities accept the documents and processes, and no new displacement or dispute undoes tenure.",
    "out-legal": "People can reach legal aid safely, and courts and offices handle cases within a reasonable time.",
  },
  MINE_ACTION: {
    "o-land": "Cleared land is handed over and used, and no new contamination occurs.",
    "out-clear": "Survey records are reliable, teams and equipment are available, and access and security allow clearance.",
    "out-eore": "People attend, remember the messages and act on them, including children and people who move through the area.",
  },
  PROTECTION: {
    "o-serv": "Services exist and have capacity, and people at risk can reach them and trust them with their information.",
    "out-case": "Caseworkers are trained and stay, and referral partners accept and act on cases.",
    "out-comm": "Community members are willing to act and are not put at risk by doing so.",
  },
  CHILD_PROTECTION: {
    "o-resp": "Caregivers and authorities cooperate, and care options and services exist for the children referred.",
    "out-spaces": "Parents allow children to attend, facilitators are trained and the space is safe.",
    "out-case": "Case workers have manageable caseloads and supervision, and follow-up visits can reach children.",
  },
  GBV: {
    "o-resp": "Survivors know the services, can reach them safely, and trust that their information stays confidential.",
    "o-prev": "Leaders and communities support the change, and the situation does not worsen through crisis or displacement.",
    "out-case": "Trained case workers are available and supervised, and referral services are open and confidential.",
    "out-safe": "Women and girls can reach the spaces safely and families allow them to take part.",
  },
  SHELTER_NFI: {
    "o-shelter": "Households have secure land or tenure to build on, and weather and conflict do not destroy what is built.",
    "o-nfi": "Items match what households need and are used as intended, and they are not sold off out of necessity.",
    "out-shelter": "Materials and skilled labour are available, and site permission and access are secured.",
    "out-nfi": "Supply arrives on time, distribution points are safe, and the right households are reached.",
  },
  WASH: {
    "o-water": "Facilities stay in use and are maintained, the source is not depleted, and no outbreak or displacement overloads supply.",
    "o-san": "Toilets are accepted and used by all, and land, water table and rainfall do not stop them working.",
    "o-hyg": "Households have soap and water to put the practices into use, and people have the time to do so.",
    "out-water": "Materials and technicians are available, land and access are agreed, and a committee or utility keeps the system running.",
    "out-quality": "Testing equipment and chlorine are available and used correctly, and users accept the treated water.",
    "out-toilets": "Households and the community agree on locations, and desludging and repair are carried out.",
    "out-hyg": "Participants attend and apply what they learn, and hygiene items are available and used.",
  },
};

/** Adds the starting assumption to each outcome and output it is written for; every other node stays as it is. */
export function withAssumptions(sector: LibrarySectorId, skeleton: readonly LogframeSkeletonNode[]): LogframeSkeletonNode[] {
  const byNode = SKELETON_ASSUMPTIONS[sector] ?? {};
  return skeleton.map((n) => (byNode[n.key] && (n.level === "OUTCOME" || n.level === "OUTPUT") ? { ...n, assumption: byNode[n.key]! } : n));
}
