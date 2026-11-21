// Original practice prompts based on the preparation topics linked for each mode.
export const modes = {
  solicitor: { name: "Solicitor training contract", source: "TCLA question bank", url: "https://www.thecorporatelawacademy.com/" },
  blackrock: { name: "BlackRock", source: "BlackRock EMEA student recruiting", url: "https://careers.blackrock.com/students-and-graduates-emea" },
  jpm: { name: "J.P. Morgan", source: "JPMorganChase interview preparation", url: "https://careers.jpmorgan.com/us/en/how-we-hire/interview-tips" },
  goldman: { name: "Goldman Sachs", source: "Goldman Sachs student recruiting", url: "https://www.goldmansachs.com/careers/students" },
  pe: { name: "London private equity", source: "BVCA investment deal process syllabus", url: "https://www.bvca.co.uk/asset/2F874208-6B64-4477-BB0330BA6FE07795/" },
} as const;
export type Mode = keyof typeof modes;
export const MAX_QUESTIONS = 6;
const prompts = {
  blackrock: [
    "Which BlackRock team would you apply to, and what have you done to understand its clients?",
    "Describe a time when you put a client or stakeholder’s interests ahead of your preferred solution.",
    "Explain an investment risk to someone investing for the first time. How would you check they understood?",
    "Tell us about a decision that improved after you asked a teammate with a different perspective.",
    "Pick a market development. How might it affect two clients with different investment horizons?",
    "Describe a mistake in an analysis. How did you find it and communicate the correction?",
  ],
  jpm: [
    "Why does this J.P. Morgan business interest you? Connect one responsibility to something you have tried.",
    "Describe a disagreement in a team. What did you do personally and what changed?",
    "You spot an inconsistent number shortly before a client presentation. Walk through your next steps.",
    "When did you have to explain a complicated finding to someone outside your team?",
    "Tell us how you handled two deadlines that could not both be met as planned.",
    "Describe a decision you made with incomplete information. Which missing fact mattered most?",
  ],
  goldman: [
    "Choose a Goldman Sachs division. Which part of its work would you like to learn first, and why?",
    "Give an example of delivering difficult news to someone who depended on your work.",
    "What feedback changed the way you work on a team? Describe what happened next.",
    "A client asks for a number you have not verified. How would you handle the conversation?",
    "Tell us about an unfamiliar problem you broke into smaller parts. What did you solve first?",
    "Which recent business development would you discuss with a client, and what would you ask them?",
  ],
  pe: [
    "A founder-owned UK software company is seeking a buyout. Give your initial investment thesis and one reason to walk away.",
    "A target reports strong EBITDA but little free cash flow. Which items would you investigate first?",
    "A London fund is assessing a UK exporter with sterling costs and euro revenues. How would you stress-test the investment?",
    "A business earns a third of its revenue from one customer. What evidence would you want before proposing a price?",
    "How would higher refinancing costs affect a leveraged buyout if the exit multiple stays flat?",
    "Choose one operating improvement for a newly acquired company. How would you measure progress before exit?",
  ],
} satisfies Record<Exclude<Mode, "solicitor">, string[]>;
export const financeQuestions = Object.entries(prompts).flatMap(([key, texts]) => {
  const mode = key as Exclude<Mode, "solicitor">;
  return texts.map((text, index) => ({
    id: `${mode}-${index + 1}`, text, category: modes[mode].name, mode, defaultEligible: true,
  }));
});
