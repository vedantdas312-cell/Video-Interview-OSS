import { financeQuestions, modes } from "../src/data/modes.ts";
import { readFileSync } from 'node:fs';

const bank = readFileSync(new URL('../Practice_Interview_Question_Bank.md', import.meta.url), 'utf8');
const questions = new Map<string, { id: string; text: string; category: string }>();
let category = '';
for (const line of bank.split('\n')) {
  if (line.startsWith('## ')) category = line.slice(3);
  const match = line.match(/^\*\*(\d+a?)\.\*\* (.+)$/);
  if (match) questions.set(match[1], { id: match[1], text: match[2], category });
}
// Resolve answers saved before the published PE question bank was introduced.
const earlierPE = [
    "A founder-owned UK software company is seeking a buyout. Give your initial investment thesis and one reason to walk away.",
    "A target reports strong EBITDA but little free cash flow. Which items would you investigate first?",
    "A London fund is assessing a UK exporter with sterling costs and euro revenues. How would you stress-test the investment?",
    "A business earns a third of its revenue from one customer. What evidence would you want before proposing a price?",
    "How would higher refinancing costs affect a leveraged buyout if the exit multiple stays flat?",
    "Choose one operating improvement for a newly acquired company. How would you measure progress before exit?",
  ];
earlierPE.forEach((text, i) => {
  const id = `pe-${i+1}`;
  questions.set(id, {id, text, category:modes.pe.name});
});
for (const q of financeQuestions) questions.set(q.id, q);
export function getQuestion(id: string | number) {
  return questions.get(String(id));
}
export function getRubric(category: string) {
  const common = [
    { name: 'Relevance to the question', guidance: 'Does the answer directly address the exact prompt? Distinguish relevant activity from the explanation requested.' },
    { name: 'Specificity and explanation', guidance: 'Look for concrete context, examples and explained significance. Do not reward jargon or invented facts.' },
    { name: 'Structure and clarity', guidance: 'Is there a coherent opening, linked development and conclusion? Judge understandable transcript structure, not accent or grammar stereotypes.' },
  ];
  if (category === modes.pe.name) common.push({ name: 'Investment judgement', guidance: 'Evaluate the investment thesis, cash flows, downside risks, assumptions and evidence relevant to this specific prompt.' });
  else if (financeQuestions.some(q => q.category === category)) common.push({ name: 'Role-specific reasoning', guidance: 'Assess the reasoning, individual actions or trade-offs the prompt asks for. Treat employer details as unverified. Avoid assuming an official employer rubric.' });
  else if (category === 'Motivation for Commercial Law') common.push({ name: 'Personal connection', guidance: 'Use the source video lesson: experience and skills alone do not explain motivation. Check what appealed to the speaker, why, and how further exploration confirmed it. Never infer inner motivation, honesty or genuineness.' });
  else if (category === 'Motivation and Firm Knowledge') common.push({ name: 'Firm relevance and reasoning', guidance: 'Check the firm, role or work addressed by the exact prompt. For motivation questions, connect relevant firm details to reasons expressed by the speaker. For business or strategy questions, explain the relevant commercial reasoning. Current firm claims are not verified; avoid filling in missing firm details.' });
  else if (category === 'Competency Interview Questions') common.push({ name: 'Actions, results and reflection', guidance: 'Check enough situation/task context, the speaker\'s individual actions, outcome and learning. STAR is a preparation aid, not a required formula.' });
  else if (category === 'Scenarios and Ethical Questions') common.push({ name: 'Reasoning and judgement', guidance: 'Check identified concerns, proportionate next steps, alternatives and reasoning. State legal facts cannot be verified without sources.' });
  else if (category.includes('Commercial') || category.includes('Business') || category === 'Technical Case Studies') common.push({ name: 'Commercial reasoning', guidance: 'Check stated business context, stakeholders, consequences and balanced reasoning. Flag absent case materials or unverified current facts; do not fabricate them.' });
  else common.push({ name: 'Self reflection', guidance: 'Check explanation of the speaker\'s own example and its significance. Assess the spoken answer, never personality, identity or employability.' });
  return common;
}
