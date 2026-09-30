(function (root) {
  "use strict";

  var D = root.VoidData;
  var extra = [
    { id: "blueprint", cat: "idea", name: "Starter Job Blueprint", fragment: "Blueprint", power: 9, cost: 20, level: 1 },
    { id: "espresso", cat: "idea", name: "High-Caffeine Espresso", fragment: "Espresso", power: 8, cost: 14, level: 1 },
    { id: "code", cat: "idea", name: "Automated Code Routine", fragment: "Code", power: 14, cost: 30, level: 2 },
    { id: "shares", cat: "idea", name: "Void Corporate Shares", fragment: "Shares", power: 20, cost: 60, level: 3 },
    { id: "library", cat: "idea", name: "Unverified Code Library", fragment: "Library", power: 16, cost: 36, level: 2 },
    { id: "quant", cat: "idea", name: "Quantitative AI Script", fragment: "Quant", power: 21, cost: 70, level: 3 },
    { id: "rocket", cat: "idea", name: "Rocket Infrastructure Blueprints", fragment: "Rocket", power: 24, cost: 90, level: 4 },
    { id: "nightcard", cat: "staff", name: "Night-Owl Staff Card", fragment: "NightOwl", power: 12, cost: 26, level: 1 },
    { id: "temp", cat: "staff", name: "Temp Worker", fragment: "Temp", power: 6, cost: 12, level: 1 },
    { id: "dropouts", cat: "staff", name: "High-School Dropouts", fragment: "Dropouts", power: 8, cost: 18, level: 1 },
    { id: "investor", cat: "staff", name: "God-Tier Angel Investor", fragment: "Investor", power: 22, cost: 80, level: 3 },
    { id: "viral", cat: "marketing", name: "Viral Trend Fragment", fragment: "Viral", power: 11, cost: 22, level: 1 },
    { id: "script", cat: "marketing", name: "Social Media Script", fragment: "Script", power: 13, cost: 28, level: 1 },
    { id: "license", cat: "marketing", name: "Black-Market Monopoly License", fragment: "License", power: 18, cost: 48, level: 2 },
    { id: "scoutintel", cat: "marketing", name: "Local Scout Intel", fragment: "Intel", power: 11, cost: 24, level: 1 },
    { id: "stunt", cat: "marketing", name: "Publicity Stunt Blueprint", fragment: "Stunt", power: 17, cost: 44, level: 2 },
    { id: "register", cat: "asset", name: "Automated Register", fragment: "Register", power: 10, cost: 24, level: 1 },
    { id: "design", cat: "asset", name: "Design Software Seed", fragment: "Design", power: 12, cost: 32, level: 2 },
    { id: "syrup", cat: "asset", name: "Sugar Syrup Inventory", fragment: "Syrup", power: 7, cost: 16, level: 1 },
    { id: "cooling", cat: "asset", name: "Hardware Cooling Core", fragment: "Cooling", power: 15, cost: 40, level: 2 },
    { id: "bond", cat: "asset", name: "Capital Market Bond", fragment: "Bond", power: 19, cost: 55, level: 3 },
    { id: "cammod", cat: "asset", name: "Security Camera Module", fragment: "Camera", power: 14, cost: 42, level: 2 },
    { id: "miner", cat: "asset", name: "Unregulated Crypto Miner", fragment: "Miner", power: 18, cost: 50, level: 3 },
    { id: "slugs", cat: "asset", name: "Discarded Silicon Slugs", fragment: "Slugs", power: 9, cost: 18, level: 1 }
  ];

  var rows = [
    [101, "blueprint", "viral", "Lunchtime Hijack", "4x revenue from 11:30 to 13:00."],
    [102, "register", "nightcard", "Midnight Shift Automator", "Ventures run from 22:00 to 04:00 with no stress gain."],
    [103, "espresso", "script", "Caffeine Overclock Loop", "5x cycle speed. Employee stress rate +20%."],
    [104, "temp", "code", "Drive-Thru Ghost Crew", "Covers an empty slot for 30 real minutes."],
    [105, "blueprint", "design", "Franchise Clone Matrix", "Doubles entry-level kiosk production."],
    [106, "syrup", "viral", "Sugar-Rush Catalyst", "Doubles manual shift pay for 5 real minutes."],
    [107, "temp", "license", "Under-The-Counter Deal", "Staff tax -15%. Hidden theft chance +2%."],
    [108, "register", "cooling", "Drive-Thru Sonar Array", "Customer cycles permanently 25% faster."],
    [109, "espresso", "design", "Secret Menu Inversion", "Premium menu slot with a static 2x margin."],
    [110, "dropouts", "shares", "Corporate Uniform Overlord", "Employee stress build-up -10%."],
    [111, "viral", "scoutintel", "Underground Guerilla Ring", "Scout velocity +50%. Rare drops doubled."],
    [112, "script", "library", "Algorithm Breakout", "45-minute Hype Wave text burst."],
    [113, "investor", "stunt", "Infinite Flex Strategy", "Visibility locked at 100% for 3 real hours."],
    [114, "viral", "dropouts", "School-Yard Network Trend", "+15% visibility during school daytime."],
    [115, "script", "design", "Clickbait Deep-Fake Node", "Marketing timed effects last 2x."],
    [116, "stunt", "bond", "Billboard Monopoly", "Visibility campaign costs -30%."],
    [117, "viral", "investor", "Sponsored Influencer Swarm", "Instant capital drop scaled by rank."],
    [118, "script", "license", "Shadow PR Firm", "Immune to audit freezes and PR penalties."],
    [119, "library", "scoutintel", "Bait-and-Switch Analytics", "Hidden resume traits are exposed."],
    [120, "stunt", "shares", "Global Brand Takeover", "Permanent 1.5x multi-venture profit."],
    [121, "cammod", "code", "Smart Camera Sentinel", "Caught thieves lose pay on the spot."],
    [122, "miner", "cooling", "Liquid-Cooled Server Rack", "Server overheat freezes are removed."],
    [123, "quant", "library", "Sandbox AI Quant Bot", "Buys the opening dip and shorts the afternoon spike."],
    [124, "library", "cammod", "Encrypted Packet Vault", "Offline business buffer expands from 24h to 72h."],
    [125, "slugs", "cooling", "Overclocked Silicon Array", "Passive research points +50%."],
    [126, "code", "miner", "Botnet Scraping Hub", "Harvests pennies every 5 real seconds."],
    [127, "cooling", "design", "Thermal Dispersion Grid", "Hardware upgrade prices -20%."],
    [128, "library", "license", "Proxy Masking Relay", "Utility bills -40%."],
    [129, "quant", "shares", "Neural Ledger Core", "+1 Void Point on each prestige mark."],
    [130, "slugs", "code", "Silicon Foundry Core", "A Tier 1 material every real hour."],
    [131, "shares", "rocket", "Galantic Seed Capital", "Liquidation value x10 toward the Moon gate."],
    [132, "scoutintel", "code", "High-Velocity Delivery Routing", "Courier clocks run 40% faster."],
    [133, "register", "rocket", "Automated Hauler Node", "Freight returns an extra component."],
    [134, "design", "slugs", "Custom Blueprint Press", "Pair recipes need one fewer ingredient."],
    [135, "scoutintel", "license", "Black-Market Supply Pipeline", "Scout crates always roll high-tier parts."],
    [136, "cooling", "rocket", "Compressed Fuel Matrix", "Moon funding gate -30%."],
    [137, "shares", "bond", "Corporate Bulk Contract", "Wholesale store prices -15%."],
    [138, "quant", "scoutintel", "Predictive Freight Matrix", "25% chance a courier doubles its payload."],
    [139, "temp", "license", "Unregulated Smuggling Grid", "Asset valuation x3. 1% audit-freeze hazard."],
    [140, "quant", "rocket", "Sovereign Launch Engine", "Fills the final 5% of the space research tree."]
  ];

  var i;
  for (i = 0; i < extra.length; i++) {
    D.ITEMS.push(extra[i]);
    D.itemById[extra[i].id] = extra[i];
  }

  var PAIRS = [];
  var pairById = {};
  var pairByKey = {};
  for (i = 0; i < rows.length; i++) {
    var row = rows[i];
    var a = row[1];
    var b = row[2];
    var key = a < b ? a + "|" + b : b + "|" + a;
    var rec = { id: row[0], a: a, b: b, key: key, name: row[3], blurb: row[4], bookKey: "pair:" + row[0] };
    PAIRS.push(rec);
    pairById[rec.id] = rec;
    if (!pairByKey[key]) pairByKey[key] = [];
    pairByKey[key].push(rec);
  }

  D.PAIRS = PAIRS;
  D.pairById = pairById;
  D.pairByKey = pairByKey;
  D.GRADS = [
    { id: "ba", xp: 5000, name: "Business Administration", text: "Tax rates -10%. Resume board holds 5." },
    { id: "pr", xp: 6000, name: "Public Relations", text: "Scout velocity +30%." },
    { id: "cs", xp: 7500, name: "Computer Science", text: "Synthesis cooldown cut by 50%." }
  ];
  D.MOON_GATE = 50000;
  D.TIER1 = ["grease", "neon", "trainee", "chalk", "fryer", "blueprint", "espresso", "temp", "viral", "syrup", "dropouts", "scoutintel", "register", "slugs"];
})(typeof window !== "undefined" ? window : globalThis);
