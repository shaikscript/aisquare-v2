export const EXAM_TEMPLATE_PACK = [
  {
    title: 'AI Evaluator Core Aptitude & Logical Reasoning Test',
    projectTaskRef: 'Core Aptitude & AI Screening',
    instructions:
      'Read each logical reasoning rule, rubric hierarchy, and AI response carefully before answering. Manage your time across objective and short-justification questions. Switching browser tabs during the session is logged.',
    isTimed: true,
    timeLimitMinutes: 25,
    pauseOnDisconnect: true,
    passingPercentage: 80,
    status: 'published',
    assignmentMode: 'assigned_only',
    questions: [
      {
        questionType: 'mcq',
        topicTag: 'Aptitude — Logical Deduction',
        difficulty: 'medium',
        scenarioContext:
          'Policy Rule: Every response containing unverified medical dosage claims MUST be flagged "Safety Escalation". Any response flagged "Safety Escalation" cannot receive a Helpfulness score above 2/5.',
        prompt:
          'Response B gives a polite, well-structured answer to a cold-remedy query, but invents a specific pediatric milligram dosage not supported by clinical sources. What is the maximum Helpfulness score Response B can receive?',
        options: ['5/5 because tone and structure are clear', '4/5 with a minor citation note', '2/5 and must be flagged Safety Escalation', '3/5 if the rest of the advice is accurate'],
        correctAnswer: '2/5 and must be flagged Safety Escalation',
        defaultMarks: 2,
        explanation: 'Under strict rubric hierarchy, an unverified medical dosage triggers Safety Escalation, capping Helpfulness at 2/5 regardless of tone.',
      },
      {
        questionType: 'mcq',
        topicTag: 'AI Evaluation — Hallucination Detection',
        difficulty: 'medium',
        scenarioContext:
          'Source Passage: "Quarterly cloud revenue grew 14% year-over-year to $4.2B in Q3, driven by enterprise storage contracts. Operating margin remained flat at 19%."\nModel Summary: "In Q3, cloud revenue rose 14% YoY to $4.2B as operating margin expanded to 19% due to new AI chip sales."',
        prompt: 'How many distinct factual hallucinations or unsupported claims appear in the Model Summary relative to the Source Passage?',
        options: ['Zero — all numbers match the source', 'One — only the AI chip claim is unsupported', 'Two — operating margin "expanded" (it was flat) AND "due to new AI chip sales" (source says enterprise storage)', 'Three — the revenue figure is also misquoted'],
        correctAnswer: 'Two — operating margin "expanded" (it was flat) AND "due to new AI chip sales" (source says enterprise storage)',
        defaultMarks: 2,
        explanation: 'Both the directional claim ("expanded" vs "remained flat") and causal attribution ("AI chip sales" vs "enterprise storage") contradict the source.',
      },
      {
        questionType: 'mcq',
        topicTag: 'AI Evaluation — Instruction Following',
        difficulty: 'medium',
        scenarioContext:
          'User Prompt: "List exactly 3 advantages of SQLite in bullet points. Keep each bullet under 12 words and do not mention mobile phones."',
        prompt:
          'Which constraint breakdown accurately describes ALL violations in the following AI output?\n• Zero-configuration serverless setup makes local testing fast.\n• Single-file storage simplifies backups across laptops and mobile phones.\n• ACID-compliant transactions protect data integrity even during unexpected power loss or system crashes.\n• Public-domain codebase with tiny footprint.',
        options: [
          'Only bullet count was violated (4 bullets instead of 3)',
          'Three violations: 4 bullets instead of 3, bullet #3 exceeds 12 words, and bullet #2 mentions mobile phones',
          'Zero violations — all instructions were followed',
          'Formatting violation only — output lacked bullet points',
        ],
        correctAnswer:
          'Three violations: 4 bullets instead of 3, bullet #3 exceeds 12 words, and bullet #2 mentions mobile phones',
        defaultMarks: 3,
        explanation: 'It outputs 4 bullets instead of 3, bullet 3 has 13 words, and bullet 2 mentions mobile phones.',
      },
      {
        questionType: 'mcq',
        topicTag: 'Aptitude — Quantitative & Data Accuracy',
        difficulty: 'easy',
        scenarioContext:
          'An evaluation batch has 240 tasks. Evaluator A grades 60% of the batch with an accuracy rate of 95%. Evaluator B grades the remaining tasks with an accuracy rate of 90%.',
        prompt: 'How many total tasks in the 240-task batch were graded accurately?',
        options: ['216 tasks', '220.8 tasks', '223.2 tasks', '228 tasks'],
        correctAnswer: '223.2 tasks',
        defaultMarks: 2,
        explanation: 'Evaluator A: 144 * 0.95 = 136.8; Evaluator B: 96 * 0.90 = 86.4; Total = 223.2 (or if tasks are discrete, let us ensure exact integer numbers!).',
      },
      {
        questionType: 'true_false',
        topicTag: 'Rubric Calibration — Preference Ranking',
        difficulty: 'easy',
        scenarioContext:
          'Guideline Principle: Factual truthfulness strictly outweighs formatting polish and verbosity when comparing two assistant responses.',
        prompt:
          'True or False: A concise 3-sentence response that accurately answers every part of the user prompt should be ranked higher than a beautifully formatted 5-section response containing a subtle factual fabrication.',
        options: ['True', 'False'],
        correctAnswer: 'True',
        defaultMarks: 1,
        explanation: 'Truthfulness and accuracy take precedence over stylistic formatting.',
      },
      {
        questionType: 'short_answer',
        topicTag: 'Written Evaluation Justification',
        difficulty: 'hard',
        scenarioContext:
          'User Prompt: "Convert 150 kilometers per hour to meters per second and show the formula."\nModel A: "150 km/h is 41.67 m/s. Formula: divide speed in km/h by 3.6."\nModel B: "To convert km/h to m/s, multiply by 3.6. 150 × 3.6 = 540 m/s."',
        prompt:
          'In 2–4 concise sentences, write a professional evaluator justification explaining which model wins and why.',
        options: [],
        correctAnswer: null,
        defaultMarks: 4,
        scoringRubric:
          'Award full marks (4/4) if the candidate clearly selects Model A, verifies the math (150 * 1000 / 3600 = 41.67 m/s), identifies Model B’s inverted conversion factor (multiplying instead of dividing by 3.6), and writes in clear objective rubric language.',
        explanation: '150 km/h = 150,000 m / 3,600 s = 41.67 m/s.',
      },
    ],
  },
  {
    title: 'Search Relevance, Online Ads & Local POI Screening Exam',
    projectTaskRef: 'Search, Ads & POI Evaluation',
    instructions:
      'Evaluate search intent, ad landing-page relevance, and local map POI accuracy carefully against standard search evaluation principles.',
    isTimed: true,
    timeLimitMinutes: 25,
    pauseOnDisconnect: true,
    passingPercentage: 80,
    status: 'published',
    assignmentMode: 'assigned_only',
    questions: [
      {
        questionType: 'mcq',
        topicTag: 'Search Intent Classification',
        difficulty: 'easy',
        scenarioContext:
          'User Query: [sbi netbanking login] — User Location: Hyderabad, India.',
        prompt: 'What is the primary user intent behind this search query?',
        options: [
          'Informational — reading news articles about banking history',
          'Navigational — reaching the official State Bank of India online banking login portal',
          'Transactional — buying a new laptop online',
          'Local in-person visit — finding ATM walking directions only',
        ],
        correctAnswer: 'Navigational — reaching the official State Bank of India online banking login portal',
        defaultMarks: 2,
        explanation: 'The user explicitly targets a specific official login portal.',
      },
      {
        questionType: 'mcq',
        topicTag: 'Search Result Utility & Freshness',
        difficulty: 'medium',
        scenarioContext:
          'User Query: [current income tax slabs india] — Query issued in 2026.\nResult Tile: Blog post from 2019 listing FY 2019–20 tax slabs without mentioning any current-year updates.',
        prompt: 'How should the evaluator rate the Relevance & Freshness of this 2019 result for the user’s query?',
        options: [
          'Fully Meets — tax slabs never change significantly',
          'Highly Meets — same topic keywords appear in the title',
          'Fails to Meet / Outdated — query requires current tax rates and outdated financial figures mislead the user',
          'Slightly Meets — acceptable as primary authoritative result',
        ],
        correctAnswer: 'Fails to Meet / Outdated — query requires current tax rates and outdated financial figures mislead the user',
        defaultMarks: 2,
        explanation: 'Queries with explicit recency intent ("current") fail when served stale statutory tax tables.',
      },
      {
        questionType: 'mcq',
        topicTag: 'Online Ads Landing Page Evaluation',
        difficulty: 'medium',
        scenarioContext:
          'User Query: [ergonomic office chair under 10000]\nSponsored Ad Copy: "Ergonomic Mesh Chairs — Free Delivery"\nLanding Page: Opens a luxury furniture catalog where the cheapest chair costs ₹68,000 and out-of-stock banners appear on budget filters.',
        prompt: 'Which Ad Evaluation rating best reflects the alignment between user intent, ad promise, and landing page experience?',
        options: [
          'Excellent Match — both involve chairs',
          'Mismatch / Poor Landing Page Experience — violates explicit budget constraint by nearly 7x',
          'Exact Intent Satisfaction — luxury upgrades always satisfy budget queries',
          'Technical Error / Broken Page — page failed to render HTML',
        ],
        correctAnswer: 'Mismatch / Poor Landing Page Experience — violates explicit budget constraint by nearly 7x',
        defaultMarks: 2,
        explanation: 'The page renders HTML fine, so it is not broken, but severely fails the explicit price constraint.',
      },
      {
        questionType: 'mcq',
        topicTag: 'POI & Local Map Verification',
        difficulty: 'medium',
        scenarioContext:
          'Map Pin Audit: Candidate POI "Sunrise Diagnostics Lab" is pinned in the middle of a multi-lane highway median 350m away from its storefront, and official street-level imagery + official website confirm it permanently closed 8 months ago.',
        prompt: 'Which validation action is required during POI & Local Map Evaluation?',
        options: [
          'Mark operational status Permanently Closed AND flag rooftop/entrance pin coordinate inaccuracy',
          'Approve the pin unchanged because highway medians are easier for drivers to spot',
          'Invent a new phone number so the listing has no empty fields',
          'Keep status Open and move the pin to a random nearby park',
        ],
        correctAnswer:
          'Mark operational status Permanently Closed AND flag rooftop/entrance pin coordinate inaccuracy',
        defaultMarks: 3,
        explanation: 'Evaluators verify real-world operational status and rooftop coordinate placement without fabricating data.',
      },
      {
        questionType: 'practical_scenario',
        topicTag: 'Search Side-by-Side Rationale',
        difficulty: 'medium',
        scenarioContext:
          'Query: [how to renew passport online india]\nResult Set Left: #1 Official Passport Seva portal, #2 Official step-by-step document checklist.\nResult Set Right: #1 Unverified third-party middleman charging extra fees with lookalike branding, #2 2016 forum thread.',
        prompt: 'Explain in 2–3 sentences why Result Set Left is strongly preferred over Result Set Right.',
        options: [],
        correctAnswer: null,
        defaultMarks: 3,
        scoringRubric:
          'Award 3/3 marks for noting authoritative official government source (Passport Seva), user safety/trust protection against deceptive middleman fees, and up-to-date procedural accuracy vs stale 2016 forum content.',
        explanation: 'Civic/government queries require authoritative official portals first.',
      },
    ],
  },
  {
    title: 'Generative Media, Audio & Multimodal Evaluation Assessment',
    projectTaskRef: 'Generative Media & Audio Grading',
    instructions:
      'Assess prompt fidelity, visual/temporal artifacts in generative outputs, and strict verbatim audio transcription rules.',
    isTimed: true,
    timeLimitMinutes: 20,
    pauseOnDisconnect: true,
    passingPercentage: 75,
    status: 'published',
    assignmentMode: 'assigned_only',
    questions: [
      {
        questionType: 'mcq',
        topicTag: 'Generative Image Prompt Fidelity',
        difficulty: 'medium',
        scenarioContext:
          'Image Prompt: "A matte ceramic coffee mug on the LEFT of a closed wooden notebook, sunlit desk, photorealistic, text on mug reads DAWN."\nGenerated Image: Photorealistic sunlit desk, mug has six-fingered reflection and sits on the RIGHT of an OPEN notebook, text reads "DWAN".',
        prompt: 'Which evaluation dimension shows the MOST direct prompt-adherence and rendering failures?',
        options: [
          'Lighting style only — sunlit desk was missing',
          'Spatial composition (right vs left), object state (open vs closed notebook), and text rendering ("DWAN" vs "DAWN")',
          'Medium mismatch — rendered as pixel art instead of photorealistic',
          'No defects — artistic license covers spatial and spelling reversals',
        ],
        correctAnswer: 'Spatial composition (right vs left), object state (open vs closed notebook), and text rendering ("DWAN" vs "DAWN")',
        defaultMarks: 2,
        explanation: 'Left/right reversal, open/closed state error, and misspelled text are classic multimodal prompt-adherence defects.',
      },
      {
        questionType: 'mcq',
        topicTag: 'Generative Video Temporal Consistency',
        difficulty: 'medium',
        scenarioContext:
          'In a 6-second AI-generated clip of a cyclist riding down a street, the bicycle frame switches from red to blue at second 3, and the front wheel briefly merges into the pavement before reappearing.',
        prompt: 'In video quality evaluation rubrics, what are these defects primarily categorized as?',
        options: [
          'Audio sample-rate clipping',
          'Temporal consistency & physics/object-permanence artifacts',
          'Desired cinematic color grading',
          'Subtitle synchronization lag',
        ],
        correctAnswer: 'Temporal consistency & physics/object-permanence artifacts',
        defaultMarks: 2,
        explanation: 'Mid-clip identity/color drift and geometry clipping violate temporal consistency and physical realism.',
      },
      {
        questionType: 'true_false',
        topicTag: 'Verbatim Audio Transcription',
        difficulty: 'easy',
        scenarioContext:
          'Guideline: Strict Verbatim Mode requires transcribing exactly what the speaker uttered, including false starts and spoken self-corrections, without paraphrasing.',
        prompt:
          'True or False: If the speaker says "Send it on Tues— sorry, Wednesday morning", a Strict Verbatim transcript should rewrite this cleanly as "Send it on Wednesday morning".',
        options: ['True', 'False'],
        correctAnswer: 'False',
        defaultMarks: 2,
        explanation: 'Rewriting removes the false start; Clean Read mode edits false starts, whereas Strict Verbatim preserves them.',
      },
      {
        questionType: 'short_answer',
        topicTag: 'Multimodal Comparative Critique',
        difficulty: 'medium',
        scenarioContext:
          'Audio TTS Comparison for an educational physics explainer:\nVoice Model X: Crisp pronunciation of formulas, natural pacing around commas, consistent warm tone.\nVoice Model Y: Slightly higher studio clarity, but reads "m/s²" literally as "m slash s two" and rushes through key definitions without pausing.',
        prompt: 'Write a 2–3 sentence comparative rating note selecting the better TTS output for learners and explaining why.',
        options: [],
        correctAnswer: null,
        defaultMarks: 4,
        scoringRubric:
          'Award 4/4 marks if candidate selects Voice Model X, highlights domain-appropriate pronunciation of scientific notation ("meters per second squared" vs literal "m slash s two") and pedagogical pacing/prosody over marginal studio sharpness.',
        explanation: 'Domain unit pronunciation and prosodic pacing are critical for educational comprehension.',
      },
    ],
  },
];

// Fix integer math on Question 4 of Exam 1 so there is zero ambiguity (250 tasks -> integer!)
EXAM_TEMPLATE_PACK[0].questions[3] = {
  questionType: 'mcq',
  topicTag: 'Aptitude — Quantitative & Data Accuracy',
  difficulty: 'easy',
  scenarioContext:
    'An evaluation batch has 200 tasks. Evaluator A grades 60% of the batch with an accuracy rate of 95%. Evaluator B grades the remaining 40% of the batch with an accuracy rate of 90%.',
  prompt: 'How many total tasks in the 200-task batch were graded accurately?',
  options: ['180 tasks', '184 tasks', '186 tasks', '190 tasks'],
  correctAnswer: '186 tasks',
  defaultMarks: 2,
  explanation: 'Evaluator A: 120 × 0.95 = 114 tasks; Evaluator B: 80 × 0.90 = 72 tasks; Total = 114 + 72 = 186 tasks.',
};
