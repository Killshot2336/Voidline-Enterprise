(function (root) {
  "use strict";

  var ITEMS = [
    { id: "grease", cat: "idea", name: "Grease Spark", fragment: "Greasefire", power: 8, cost: 12, level: 1 },
    { id: "neon", cat: "idea", name: "Neon Jingle", fragment: "Neon", power: 10, cost: 18, level: 1 },
    { id: "orbit", cat: "idea", name: "Orbit Menu", fragment: "Orbital", power: 14, cost: 28, level: 2 },
    { id: "hush", cat: "idea", name: "Hush Recipe", fragment: "Hush", power: 12, cost: 26, level: 2 },
    { id: "broth", cat: "idea", name: "Void Broth", fragment: "Broth", power: 18, cost: 40, level: 3 },
    { id: "static", cat: "idea", name: "Gold Static", fragment: "Static", power: 16, cost: 36, level: 3 },
    { id: "lunar", cat: "idea", name: "Lunar Fry", fragment: "Lunar", power: 20, cost: 55, level: 4 },
    { id: "charter", cat: "idea", name: "Charter Seed", fragment: "Charter", power: 22, cost: 70, level: 4 },

    { id: "trainee", cat: "staff", name: "Trainee Chip", fragment: "Trainee", power: 6, cost: 10, level: 1 },
    { id: "closer", cat: "staff", name: "Closer Chip", fragment: "Closer", power: 14, cost: 30, level: 2 },
    { id: "owl", cat: "staff", name: "Night Owl Chip", fragment: "Nocturne", power: 12, cost: 24, level: 2 },
    { id: "incentive", cat: "staff", name: "Incentive Chip", fragment: "Incentive", power: 16, cost: 34, level: 2 },
    { id: "archivist", cat: "staff", name: "Archivist Chip", fragment: "Archivist", power: 18, cost: 48, level: 3 },
    { id: "warden", cat: "staff", name: "Warden Chip", fragment: "Warden", power: 20, cost: 80, level: 4 },

    { id: "chalk", cat: "marketing", name: "Sidewalk Chalk", fragment: "Chalk", power: 5, cost: 8, level: 1 },
    { id: "poster", cat: "marketing", name: "Street Poster", fragment: "Poster", power: 11, cost: 20, level: 1 },
    { id: "jingle", cat: "marketing", name: "Jingle Buy", fragment: "Jingle", power: 13, cost: 22, level: 2 },
    { id: "beacon", cat: "marketing", name: "Lunch Beacon", fragment: "Beacon", power: 17, cost: 38, level: 2 },
    { id: "halo", cat: "marketing", name: "Halo Spot", fragment: "Halo", power: 19, cost: 44, level: 3 },
    { id: "parade", cat: "marketing", name: "Void Parade", fragment: "Parade", power: 24, cost: 75, level: 4 },

    { id: "fryer", cat: "asset", name: "Used Fryer", fragment: "Fryer", power: 7, cost: 15, level: 1 },
    { id: "lens", cat: "asset", name: "Camera Core", fragment: "Lens", power: 15, cost: 42, level: 2 },
    { id: "scooter", cat: "asset", name: "Scout Scooter", fragment: "Scooter", power: 12, cost: 32, level: 2 },
    { id: "rack", cat: "asset", name: "Server Rack", fragment: "Rack", power: 18, cost: 60, level: 3 },
    { id: "kiosk", cat: "asset", name: "Gold Kiosk", fragment: "Kiosk", power: 16, cost: 36, level: 2 },
    { id: "relay", cat: "asset", name: "Star Relay", fragment: "Relay", power: 23, cost: 90, level: 4 }
  ];

  var RECIPES = [
    ["grease", "trainee", "chalk", "fryer", "Corner Dynasty", 1.18, "revenue"],
    ["grease", "closer", "poster", "kiosk", "Sizzle Contract", 1.22, "revenue"],
    ["grease", "owl", "jingle", "scooter", "Night Grease Run", 1.16, "night"],
    ["grease", "incentive", "beacon", "lens", "Incentive Fryer", 1.2, "wage"],
    ["grease", "archivist", "halo", "rack", "Audit-Proof Kiosk", 1.24, "theft"],
    ["grease", "warden", "parade", "relay", "Fryer Sovereignty", 1.35, "revenue"],
    ["neon", "trainee", "chalk", "scooter", "Neon Errand", 1.15, "visibility"],
    ["neon", "closer", "poster", "kiosk", "Marquee Close", 1.28, "revenue"],
    ["neon", "owl", "jingle", "lens", "Midnight Jingle", 1.22, "night"],
    ["neon", "incentive", "beacon", "fryer", "Lunch Neon", 1.26, "lunch"],
    ["neon", "archivist", "halo", "rack", "Signal Archive", 1.2, "xp"],
    ["neon", "warden", "parade", "relay", "Parade Relay", 1.32, "visibility"],
    ["orbit", "trainee", "poster", "scooter", "Orbit Route", 1.18, "scout"],
    ["orbit", "closer", "jingle", "kiosk", "Menu Closer", 1.24, "revenue"],
    ["orbit", "owl", "beacon", "lens", "Orbital Watch", 1.22, "scout"],
    ["orbit", "incentive", "halo", "rack", "Incentive Orbit", 1.21, "xp"],
    ["orbit", "archivist", "chalk", "fryer", "Grease Atlas", 1.17, "int"],
    ["orbit", "warden", "parade", "relay", "Charter Orbit", 1.34, "scout"],
    ["hush", "trainee", "chalk", "lens", "Quiet Camera", 1.2, "theft"],
    ["hush", "closer", "poster", "rack", "Silent Close", 1.23, "stress"],
    ["hush", "owl", "jingle", "scooter", "Hush Route", 1.19, "night"],
    ["hush", "incentive", "beacon", "kiosk", "Soft Sell", 1.25, "revenue"],
    ["hush", "archivist", "halo", "fryer", "Recipe Vault", 1.22, "xp"],
    ["hush", "warden", "parade", "relay", "Black Parade", 1.33, "visibility"],
    ["broth", "trainee", "beacon", "fryer", "Broth Service", 1.27, "lunch"],
    ["broth", "closer", "halo", "kiosk", "Gold Broth", 1.3, "revenue"],
    ["broth", "owl", "chalk", "scooter", "Night Kitchen", 1.18, "night"],
    ["broth", "incentive", "poster", "lens", "Watched Incentive", 1.24, "theft"],
    ["broth", "archivist", "jingle", "rack", "Server Broth", 1.26, "cycle"],
    ["broth", "warden", "parade", "relay", "Void Banquet", 1.4, "revenue"],
    ["static", "trainee", "jingle", "rack", "Static Desk", 1.2, "xp"],
    ["static", "closer", "halo", "relay", "Gold Static Close", 1.31, "revenue"],
    ["static", "owl", "poster", "lens", "Static Watch", 1.23, "theft"],
    ["static", "incentive", "beacon", "scooter", "Rush Courier", 1.22, "lunch"],
    ["static", "archivist", "chalk", "fryer", "Catalog Fry", 1.16, "int"],
    ["static", "warden", "parade", "kiosk", "Sovereign Kiosk", 1.36, "revenue"],
    ["lunar", "trainee", "halo", "scooter", "Lunar Route", 1.21, "scout"],
    ["lunar", "closer", "parade", "relay", "Lunar Close", 1.38, "revenue"],
    ["lunar", "owl", "beacon", "lens", "Moonlit Lens", 1.25, "night"],
    ["charter", "warden", "parade", "relay", "Voidline Charter", 1.5, "revenue"]
  ];

  var JOBS = [
    { id: "fast_food", name: "Fast Food Kiosk", level: 1, node: null, base: 8, line: "entry" },
    { id: "counter_lead", name: "Counter Lead", level: 1, node: null, skill: "work", skillNeed: 4, base: 12, line: "entry" },
    { id: "tutor_desk", name: "Tutor Desk", level: 1, node: null, skill: "mind", skillNeed: 4, base: 11, line: "entry" },
    { id: "marketing", name: "Marketing Desk", level: 2, node: "poster", base: 14, line: "visibility" },
    { id: "automation", name: "Automation Bay", level: 2, node: "timer", base: 13, line: "tech" },
    { id: "scout_lead", name: "Brand Scout Lead", level: 3, node: "charter", base: 15, line: "visibility" },
    { id: "server", name: "Server Ops", level: 4, node: "rack", base: 17, line: "tech" },
    { id: "pr", name: "Galactic PR", level: 5, node: "pr", base: 20, line: "visibility" },
    { id: "engineer", name: "Voidline Engineer", level: 6, node: "core", base: 24, line: "tech" }
  ];

  var NODES = [
    { id: "poster", line: "visibility", name: "Street Poster", cost: 1, requires: null, text: "Unlocks the Marketing Desk and poster contracts." },
    { id: "charter", line: "visibility", name: "Scout Charter", cost: 2, requires: "poster", text: "Dispatch scouts. Unlocks Brand Scout Lead." },
    { id: "brand", line: "visibility", name: "Brand Engine", cost: 2, requires: "charter", text: "Visibility gains are 25% stronger." },
    { id: "pr", line: "visibility", name: "Galactic PR", cost: 3, requires: "brand", text: "Unlocks the Galactic PR desk." },
    { id: "timer", line: "tech", name: "Fryer Timer", cost: 1, requires: null, text: "Customer cycles run 20% faster." },
    { id: "camera", line: "tech", name: "Camera Schematic", cost: 2, requires: "timer", text: "Invent a Security Camera Module for a venture slot." },
    { id: "rack", line: "tech", name: "Server Rack", cost: 2, requires: "camera", text: "Unlocks Server Ops, a second slot, and +10 stock cap." },
    { id: "core", line: "tech", name: "Voidline Core", cost: 3, requires: "rack", text: "Unlocks Voidline Engineer." },
    { id: "shady_open", line: "shady", name: "Street Sense", cost: 1, requires: null, text: "Opens the shady tree. Heat starts counting." },
    { id: "skim", line: "shady", name: "Skim", cost: 1, requires: "shady_open", text: "A petty take from a drawer. Small cash. Heat moves." },
    { id: "backroom", line: "shady", name: "Back Room", cost: 2, requires: "skim", text: "Shifts pay a quiet extra. Heat ticks up with them." },
    { id: "score", line: "shady", name: "Big Score", cost: 3, requires: "backroom", text: "One card. It can pay, or you sit out the clock." }
  ];

  var LIFE = [
    { id: "landlord", kicker: "RENT", rail: "#e23d3d", line: "The landlord is in the doorway. Rent is {rent}.", a: "rentpay", aLabel: "Pay {rent}", b: "rentstall", bLabel: "Stall" },
    { id: "heat", kicker: "HEAT", rail: "#b44ac0", line: "Heat is {heat}. The room feels watched.", a: "rest", aLabel: "Lay low", b: "shift", bLabel: "Stay open" },
    { id: "rival", kicker: "RIVAL", rail: "#e23d3d", line: "{rival} opened across the street. Lunch is thinner until you have a sign.", a: "upgrade:sign", aLabel: "Paint a sign", b: "shift", bLabel: "Work anyway" },
    { id: "regular", kicker: "REGULAR", rail: "#3ec8d8", line: "{name} came back. Visit {visits}.", a: "comp", aLabel: "Comp a meal", b: "greet", bLabel: "Charge full" },
    { id: "floor", kicker: "UPSTAIRS", rail: "#f5c542", line: "The floor above is empty. {floor} takes it.", a: "floor", aLabel: "Buy the floor", b: "shift", bLabel: "Not this year" },
    { id: "thin", kicker: "RESTOCK", rail: "#e23d3d", line: "The shelf is almost bare. People are still in line.", a: "stock:0", aLabel: "Restock", b: "shift", bLabel: "Work anyway" },
    { id: "morn_line", when: "morning", once: true, kicker: "MORNING", rail: "#f5c542", line: "Morning rush. Year {year}. Everyone wants food.", a: "shift", aLabel: "Work the rush", b: "rest", bLabel: "Breathe" },
    { id: "lunch_line", when: "lunch", once: true, kicker: "LUNCH", rail: "#f5c542", line: "Lunch rush. The line is out the door.", a: "shift", aLabel: "Work the rush", b: "stock:0", bLabel: "Check stock" },
    { id: "eve_line", when: "evening", once: true, kicker: "EVENING", rail: "#3ec8d8", line: "After school. The shop fills with people killing time.", a: "shift", aLabel: "Work it", b: "hobby", bLabel: "Tutor instead" },
    { id: "night_line", when: "night", once: true, kicker: "NIGHT", rail: "#3ec8d8", line: "Late night. Regulars and weirdos, that's the crowd.", a: "shift", aLabel: "Stay open", b: "rest", bLabel: "Lock up" },
    { id: "slow_line", when: "standard", once: true, kicker: "SLOW", rail: "#3ec8d8", line: "Slow hour. You can hear the fryer.", a: "hobby", aLabel: "Do a hobby", b: "shift", bLabel: "Work anyway" },
    { id: "work_hands", when: "any", workMin: 2, once: true, kicker: "WORK", rail: "#f5c542", line: "Your hands know the counter. Year {year}.", a: "shift", aLabel: "Work it", b: "tab:job", bLabel: "See jobs" },
    { id: "mind_spark", when: "any", mindMin: 3, once: true, kicker: "HOBBY", rail: "#3ec8d8", line: "What you taught is starting to stick.", a: "hobby:nightclass", aLabel: "Night class", b: "hobby", bLabel: "Tutor again" },
    { id: "sign_holds", when: "any", sign: true, rival: true, once: true, kicker: "SIGN", rail: "#f5c542", line: "The sign is doing the talking. {rival}'s line looks thinner.", a: "shift", aLabel: "Work the rush", b: "rest", bLabel: "Enjoy it" },
    { id: "upstairs_quiet", when: "any", floor: true, once: true, kicker: "UPSTAIRS", rail: "#f5c542", line: "Upstairs is yours. The building feels taller.", a: "shift", aLabel: "Work downstairs", b: "hobby", bLabel: "Use the quiet" },
    { id: "street_quiet", when: "any", shady: true, once: true, kicker: "HEAT", rail: "#b44ac0", line: "The other tree is open. The street is watching a little.", a: "rest", aLabel: "Lay low", b: "shift", bLabel: "Stay legit" },
    { id: "year_open", when: "any", once: true, kicker: "YEAR", rail: "#f5c542", line: "Year {year}. The corner is still here.", a: "shift", aLabel: "Work the year", b: "hobby", bLabel: "Learn something" }
  ];

  var HOBBIES = [
    { id: "tutor", name: "Tutor", skill: "mind", needSkill: "mind", need: 0, pay: 6, xp: 8, text: "One lesson. A little cash, a little mind." },
    { id: "flip", name: "Flip a find", skill: "hustle", needSkill: "hustle", need: 0, pay: 5, xp: 6, text: "Resell a scrap. Hustle starts here." },
    { id: "stream", name: "Late stream", skill: "clout", needSkill: "mind", need: 2, pay: 7, xp: 8, text: "Talk until somebody stays." },
    { id: "nightclass", name: "Night class", skill: "mind", needSkill: "mind", need: 3, pay: 4, xp: 18, text: "You teach, then you study." }
  ];

  var DEGREES = [
    { id: "cert", name: "Fry Certificate", ms: 45000, cost: 25, level: 1, text: "+8 Intelligence. Short clock." },
    { id: "assoc", name: "Market Associate", ms: 180000, cost: 80, level: 2, text: "+8 Visibility, +6 Intelligence." },
    { id: "bach", name: "Operations Bachelor", ms: 480000, cost: 200, level: 4, text: "Opens a second venture slot. +10 Intelligence." },
    { id: "mba", name: "Voidline MBA", ms: 1200000, cost: 480, level: 6, text: "Wage dossiers show a negotiation range." },
    { id: "doc", name: "Galactic Doctorate", ms: 2700000, cost: 900, level: 8, text: "+1 Void Point, +15 Intelligence." }
  ];

  var SCOUTS = [
    { id: "block", name: "Block Circuit", ms: 40000, cost: 30, text: "A short clock run. Returns a material." },
    { id: "city", name: "City Sweep", ms: 180000, cost: 80, text: "Wider net. Better materials and visibility." },
    { id: "orbital", name: "Orbital Survey", ms: 720000, cost: 200, text: "Long clock. Chance to reveal a legendary recipe." }
  ];

  var TRAITS = {
    hyper: { id: "hyper", name: "Hyper-Incentivized", positive: true, hidden: false },
    closer: { id: "closer", name: "Closer", positive: true, hidden: false },
    owl: { id: "owl", name: "Night Owl", positive: true, hidden: false },
    loyal: { id: "loyal", name: "Loyal", positive: true, hidden: false },
    fingers: { id: "fingers", name: "Sticky Fingers", positive: false, hidden: true },
    slacker: { id: "slacker", name: "Slacker", positive: false, hidden: true },
    clock: { id: "clock", name: "Clock Watcher", positive: false, hidden: true }
  };

  var FIRST = ["Nova", "Kade", "Sera", "Ivo", "Pax", "Jun", "Rook", "Vela", "Quill", "Nim", "Orin", "Tess", "Bram", "Ysolde"];
  var LAST = ["Voss", "Keel", "Amar", "Drake", "Solen", "Pike", "Hale", "Mori", "Ash", "Quill", "Rune", "Vale"];

  var itemById = {};
  var i;
  for (i = 0; i < ITEMS.length; i++) itemById[ITEMS[i].id] = ITEMS[i];

  var recipeByKey = {};
  var recipeList = [];
  for (i = 0; i < RECIPES.length; i++) {
    var row = RECIPES[i];
    var key = row[0] + "|" + row[1] + "|" + row[2] + "|" + row[3];
    var recipe = {
      key: key,
      idea: row[0],
      staff: row[1],
      marketing: row[2],
      asset: row[3],
      name: row[4],
      mult: row[5],
      tag: row[6]
    };
    recipeByKey[key] = recipe;
    recipeList.push(recipe);
  }

  var jobById = {};
  for (i = 0; i < JOBS.length; i++) jobById[JOBS[i].id] = JOBS[i];
  var nodeById = {};
  for (i = 0; i < NODES.length; i++) nodeById[NODES[i].id] = NODES[i];
  var degreeById = {};
  for (i = 0; i < DEGREES.length; i++) degreeById[DEGREES[i].id] = DEGREES[i];
  var scoutById = {};
  for (i = 0; i < SCOUTS.length; i++) scoutById[SCOUTS[i].id] = SCOUTS[i];
  var hobbyById = {};
  for (i = 0; i < HOBBIES.length; i++) hobbyById[HOBBIES[i].id] = HOBBIES[i];
  var lifeById = {};
  for (i = 0; i < LIFE.length; i++) lifeById[LIFE[i].id] = LIFE[i];

  root.VoidData = {
    ITEMS: ITEMS,
    RECIPES: recipeList,
    JOBS: JOBS,
    NODES: NODES,
    DEGREES: DEGREES,
    SCOUTS: SCOUTS,
    HOBBIES: HOBBIES,
    hobbyById: hobbyById,
    ROOM: { rent: 40, lights: 25, sign: 30, counter: 45, floor: 120 },
    LIFE: LIFE,
    lifeById: lifeById,
    TRAITS: TRAITS,
    FIRST: FIRST,
    LAST: LAST,
    itemById: itemById,
    recipeByKey: recipeByKey,
    jobById: jobById,
    nodeById: nodeById,
    degreeById: degreeById,
    scoutById: scoutById,
    LOG_CAP: 64,
    SYNERGY: 0.115,
    W_IDEA: 0.3,
    W_STAFF: 0.3,
    W_MKT: 0.2,
    W_ASSET: 0.2,
    SAVE_KEY: "voidline.enterprise.v1",
    CAM_COST: 150,
    STOCK_PACK: 4,
    STOCK_PRICE: 5,
    MULT_CAP: 3.5
  };
})(typeof window !== "undefined" ? window : globalThis);
