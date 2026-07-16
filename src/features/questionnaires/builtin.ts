import type { Question } from "./types";

export interface QuestionnaireStarter {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

/** Editable starter questionnaires — forked into the user's library on use. */
export const QUESTIONNAIRE_STARTERS: QuestionnaireStarter[] = [
  {
    id: "web-design-intake",
    title: "Web design intake",
    description:
      "Collect everything you need before starting a website or web app build.",
    questions: [
      { id: "q1", type: "short_text", label: "Business / brand name", required: true },
      { id: "q2", type: "long_text", label: "What does your business do, and who are your customers?", required: true },
      { id: "q3", type: "long_text", label: "What are the main goals for this website?", required: true },
      {
        id: "q4",
        type: "multi_choice",
        label: "Which pages do you need?",
        required: false,
        options: ["Home", "About", "Services", "Portfolio", "Blog", "Contact", "Pricing", "Shop"],
      },
      { id: "q5", type: "long_text", label: "Share 2–3 websites you like and what you like about them", required: false },
      {
        id: "q6",
        type: "single_choice",
        label: "Do you have brand assets (logo, colors, fonts)?",
        required: false,
        options: ["Yes, ready to share", "Partially", "No, need help creating them"],
      },
      { id: "q7", type: "date", label: "Ideal launch date", required: false },
      { id: "q8", type: "file", label: "Link to your assets (Drive, Dropbox, etc.)", required: false },
    ],
  },
  {
    id: "branding-brief",
    title: "Branding brief",
    description: "A focused brief for logo, identity, and brand direction work.",
    questions: [
      { id: "q1", type: "short_text", label: "Brand name", required: true },
      { id: "q2", type: "long_text", label: "Describe your brand's mission and personality", required: true },
      { id: "q3", type: "long_text", label: "Who are your main competitors?", required: false },
      {
        id: "q4",
        type: "single_choice",
        label: "Which style feels right?",
        required: false,
        options: ["Minimal & modern", "Bold & playful", "Classic & elegant", "Tech & futuristic", "Warm & organic"],
      },
      { id: "q5", type: "short_text", label: "Any color preferences or colors to avoid?", required: false },
      { id: "q6", type: "yes_no", label: "Do you need a new logo?", required: false },
      { id: "q7", type: "rating", label: "How established is the brand today? (1 = brand new, 5 = well known)", required: false, max: 5 },
      { id: "q8", type: "file", label: "Link to any references or existing brand files", required: false },
    ],
  },
  {
    id: "project-brief",
    title: "Generic project brief",
    description: "A flexible brief that fits most freelance projects.",
    questions: [
      { id: "q1", type: "short_text", label: "Project name", required: true },
      { id: "q2", type: "long_text", label: "Describe the project in a few sentences", required: true },
      { id: "q3", type: "long_text", label: "What does success look like?", required: false },
      { id: "q4", type: "long_text", label: "What are the key deliverables?", required: false },
      { id: "q5", type: "date", label: "Target deadline", required: false },
      {
        id: "q6",
        type: "dropdown",
        label: "Budget range",
        required: false,
        options: ["Under ₹25k", "₹25k – ₹75k", "₹75k – ₹2L", "₹2L+", "Not sure yet"],
      },
      { id: "q7", type: "long_text", label: "Anything else we should know?", required: false },
    ],
  },
];

export function getStarter(id: string): QuestionnaireStarter | undefined {
  return QUESTIONNAIRE_STARTERS.find((s) => s.id === id);
}
