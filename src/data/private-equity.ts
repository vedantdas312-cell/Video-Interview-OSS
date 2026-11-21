// Published interview material. Stable IDs allow saved rounds to keep their original questions.
const bank = {
  cdr: { label: "Candidate report · CD&R London, summer associate intern, Sep 2026", url: "https://www.wallstreetoasis.com/company/clayton-dubilier-rice-cdr/interview/summer-intern" },
  bridgepointAnalyst: { label: "Candidate report · Bridgepoint London analyst interviews, 2023 and 2025", url: "https://www.glassdoor.co.uk/Interview/Bridgepoint-Analyst-Interview-Questions-EI_IE36053.0%2C11_KO12%2C19.htm" },
  bridgepoint: { label: "Candidate report · Bridgepoint London interviews, 2026", url: "https://www.glassdoor.co.uk/Interview/Bridgepoint-Interview-Questions-E36053.htm" },
  zrive: { label: "Practice bank · Zrive PE recruiting guide, p. 6", url: "https://club.zriveapp.com/app/uploads/2024/01/2024_Zrive_PE_Recruiting-Process.pdf#page=6" },
  wsp: { label: "Practice bank · Wall Street Prep technical interview guide", url: "https://www.wallstreetprep.com/knowledge/25-private-equity-interview-questions-you-must-know/" },
};
const entries: [string, keyof typeof bank, string][] = [
  ["pitch", "cdr", "Pitch a company you would buy using debt. Why could that business support the borrowing?"],
  ["fit", "bridgepointAnalyst", "What draws you to Bridgepoint, and why would you choose investing over a career in banking?"],
  ["lbo", "bridgepointAnalyst", "Explain a leveraged buyout to someone who has never worked on one."],
  ["sector", "bridgepoint", "Pick a sector you know. Which company in it would you invest in, and why?"],
  ["returns", "bridgepoint", "An investor asks for net IRR and the multiple on invested capital. What does each figure tell them?"],
  ["track-record", "zrive", "Revisit a transaction you worked on or studied. How did the business earn money, and would you have put your own capital into it?"],
  ["paper-lbo", "zrive", "You have a blank sheet and a buyout to evaluate. Which inputs would you ask for to estimate the sponsor’s return?"],
  ["multiple", "zrive", "What drives the valuation multiple a buyer will pay for a business? Pick the three factors you would examine first."],
  ["value-creation", "zrive", "After acquiring a company, where would you look for ways to make the business more valuable?"],
  ["funding", "wsp", "At closing, which payments must the buyer fund, and where can the money for those payments come from?"],
  ["exit", "wsp", "A fund is ready to sell its stake. Which exit routes would you consider, and who would buy in each case?"],
  ["equity-bridge", "wsp", "Trace a sponsor’s return from purchase to sale. How do operating performance, debt repayment and the exit valuation each contribute?"],
];
export const privateEquityQuestions = entries.map(([id, key, text]) => ({
  id: "pe-" + id, text, source: bank[key], category: "London private equity", mode: "pe" as const, defaultEligible: true,
}));
