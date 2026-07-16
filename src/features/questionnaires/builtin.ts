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
  {
    id: "seo-onboarding",
    title: "SEO onboarding",
    description:
      "Everything you need before starting an SEO engagement — goals, access, competitors, and current state.",
    questions: [
      { id: "q1", type: "short_text", label: "Website URL", required: true },
      { id: "q2", type: "long_text", label: "What are your main goals for SEO?", required: true, help: "e.g. more leads, more organic traffic, ranking for specific terms" },
      { id: "q3", type: "long_text", label: "Which keywords or topics do you most want to rank for?", required: false },
      { id: "q4", type: "long_text", label: "Who are your top 3 competitors (URLs)?", required: false },
      { id: "q5", type: "yes_no", label: "Can you give access to Google Analytics & Search Console?", required: true },
      { id: "q6", type: "single_choice", label: "Do you have any current rankings you must not lose?", required: false, options: ["Yes — will share", "No", "Not sure"] },
      { id: "q7", type: "multi_choice", label: "Which are in place today?", required: false, options: ["Google Business Profile", "Blog / content", "Backlinks", "Structured data", "None of these"] },
      { id: "q8", type: "short_text", label: "Target locations / regions", required: false },
      { id: "q9", type: "long_text", label: "Anything that's held back SEO so far?", required: false },
    ],
  },
  {
    id: "marketing-intake",
    title: "Marketing / growth intake",
    description:
      "Understand goals, audience, budget, and channels before planning a marketing engagement.",
    questions: [
      { id: "q1", type: "short_text", label: "Company / brand name", required: true },
      { id: "q2", type: "long_text", label: "What are your primary marketing goals?", required: true, help: "e.g. leads, sales, awareness, launch" },
      { id: "q3", type: "long_text", label: "Describe your target audience", required: true },
      { id: "q4", type: "multi_choice", label: "Which channels are you interested in?", required: false, options: ["SEO", "Google Ads", "Meta / Instagram", "LinkedIn", "Email", "Content", "Influencer"] },
      { id: "q5", type: "dropdown", label: "Approximate monthly marketing budget", required: false, options: ["Under ₹25k", "₹25k – ₹1L", "₹1L – ₹3L", "₹3L+", "Not sure yet"] },
      { id: "q6", type: "long_text", label: "Who are your main competitors?", required: false },
      { id: "q7", type: "single_choice", label: "What's your biggest challenge right now?", required: false, options: ["Not enough leads", "Low conversion", "Weak brand", "Inconsistent effort", "Other"] },
      { id: "q8", type: "long_text", label: "What's worked (or not) for you before?", required: false },
      { id: "q9", type: "file", label: "Link to any existing brand assets or data", required: false },
    ],
  },
  {
    id: "content-brief",
    title: "Content & copywriting brief",
    description:
      "Capture voice, audience, goals, and specifics for a writing project.",
    questions: [
      { id: "q1", type: "short_text", label: "Project / piece title", required: true },
      { id: "q2", type: "long_text", label: "What is this content for, and what should it achieve?", required: true },
      { id: "q3", type: "long_text", label: "Who is the audience? (role, needs, awareness)", required: true },
      { id: "q4", type: "single_choice", label: "Desired tone", required: false, options: ["Professional", "Friendly & casual", "Bold & punchy", "Warm & empathetic", "Technical / precise"] },
      { id: "q5", type: "long_text", label: "Key points or takeaways that must be included", required: false },
      { id: "q6", type: "short_text", label: "Approx. length or format", required: false, help: "e.g. 800-word blog, 5 emails, homepage copy" },
      { id: "q7", type: "long_text", label: "Any words, phrases, or claims to avoid?", required: false },
      { id: "q8", type: "file", label: "Links to reference content you like", required: false },
      { id: "q9", type: "date", label: "When do you need it by?", required: false },
    ],
  },
  {
    id: "social-intake",
    title: "Social media management intake",
    description:
      "Set up a social engagement — platforms, voice, goals, and content preferences.",
    questions: [
      { id: "q1", type: "short_text", label: "Brand name & handles", required: true },
      { id: "q2", type: "multi_choice", label: "Which platforms should we manage?", required: true, options: ["Instagram", "Facebook", "LinkedIn", "X / Twitter", "YouTube", "TikTok"] },
      { id: "q3", type: "long_text", label: "What do you want social media to achieve?", required: true },
      { id: "q4", type: "long_text", label: "Describe your brand voice / personality", required: false },
      { id: "q5", type: "long_text", label: "What should we post about? Any topics to avoid?", required: false },
      { id: "q6", type: "number", label: "Preferred posts per week", required: false },
      { id: "q7", type: "single_choice", label: "Do you have brand assets / photography?", required: false, options: ["Yes, plenty", "Some", "No — need help"] },
      { id: "q8", type: "long_text", label: "Accounts you admire (and why)", required: false },
      { id: "q9", type: "yes_no", label: "Will you approve a monthly content calendar before posting?", required: false },
    ],
  },
  {
    id: "app-discovery",
    title: "App / product discovery",
    description:
      "Scope a web or mobile product — problem, users, features, and constraints.",
    questions: [
      { id: "q1", type: "short_text", label: "Product / app name", required: true },
      { id: "q2", type: "long_text", label: "What problem does it solve, and for whom?", required: true },
      { id: "q3", type: "long_text", label: "Describe the must-have features for a first version (MVP)", required: true },
      { id: "q4", type: "single_choice", label: "Platform", required: false, options: ["Web app", "iOS", "Android", "iOS + Android", "Not sure"] },
      { id: "q5", type: "multi_choice", label: "Which will you need?", required: false, options: ["User accounts / login", "Payments", "Admin dashboard", "Notifications", "Third-party integrations", "Analytics"] },
      { id: "q6", type: "single_choice", label: "Do you have designs already?", required: false, options: ["Yes — Figma/other", "Wireframes only", "No — need design"] },
      { id: "q7", type: "long_text", label: "Any similar products for reference?", required: false },
      { id: "q8", type: "dropdown", label: "Budget range", required: false, options: ["Under ₹1L", "₹1L – ₹5L", "₹5L – ₹15L", "₹15L+", "Not sure yet"] },
      { id: "q9", type: "date", label: "Target launch date (if any)", required: false },
    ],
  },
  {
    id: "creative-brief",
    title: "Photo / video brief",
    description:
      "Plan a shoot — goals, deliverables, style, logistics, and usage.",
    questions: [
      { id: "q1", type: "short_text", label: "Project name", required: true },
      { id: "q2", type: "single_choice", label: "What are we producing?", required: true, options: ["Photography", "Video", "Both"] },
      { id: "q3", type: "long_text", label: "What's the goal, and where will it be used?", required: true, help: "e.g. website, ads, social, print" },
      { id: "q4", type: "long_text", label: "Describe the look and feel you're after", required: false },
      { id: "q5", type: "file", label: "Links to references / mood you love", required: false },
      { id: "q6", type: "short_text", label: "Preferred location(s)", required: false },
      { id: "q7", type: "number", label: "Approx. number of final deliverables needed", required: false },
      { id: "q8", type: "single_choice", label: "Usage rights needed", required: false, options: ["Web + social only", "Full commercial", "Not sure"] },
      { id: "q9", type: "date", label: "Preferred shoot date", required: false },
    ],
  },
];

export function getStarter(id: string): QuestionnaireStarter | undefined {
  return QUESTIONNAIRE_STARTERS.find((s) => s.id === id);
}
