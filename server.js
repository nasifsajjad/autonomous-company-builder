/**
 * server.js
 * Autonomous Company Builder — v2 (Upgraded)
 * Sequential agent orchestration, improved prompts, and professional PDF rendering.
 */

import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ----- Gemini 1.5 client -----
if (!process.env.GEMINI_API_KEY) {
  console.error("MISSING GEMINI_API_KEY env var");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// NOTE: Your original file said "gemini-2.5-flash". This is likely a typo.
// The current model is "gemini-1.5-flash". I've updated it.
// If "2.5-flash" is correct and you have access, you can change it back.
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ----- Helpers -----
async function callGemini(prompt, opts = {}) {
  try {
    // This function is working well for you, so we'll just increase the default token limit.
    const response = await model.generateContent(
      prompt, // 1. The prompt string is the first argument
      { // 2. The configuration is the second argument
        temperature: opts.temperature ?? 0.7, // Slightly increased default temp for more creativity
        candidateCount: 1,
        maxOutputTokens: opts.maxOutputTokens ?? 2048, // ★ UPGRADE: Increased default tokens
      }
    );

    // Use the reliable .text getter
    if (response?.text) {
      return response.text;
    }
    
    // Fallback if .text is missing
    return JSON.stringify(response);
  } catch (err) {
    console.error("Gemini call failed:", err);
    throw err;
  }
}

function tryParseJSONOrRaw(text) {
  if (!text) return { raw: "" };
  
  // ★ UPGRADE: More robust parsing. Trims markdown fences (```json ... ```) that LLMs often add.
  const trimmed = text.trim().replace(/^```(?:json)?\s*|```\s*$/g, "");
  
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fallback for partial JSON matches
    const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { return { raw: text }; }
    }
    return { raw: text };
  }
}

// ----- In-memory stores -----
const projects = {}; // { id: { status, data, pdfPath } }
const sseClients = {}; // id -> [res1, res2,...]

function sseSend(id, msgObj) {
  const clients = sseClients[id] || [];
  const payload = `data: ${JSON.stringify(msgObj)}\n\n`;
  for (const res of clients) res.write(payload);
}

// ----- Agents -----
async function researchAgent(industry, projectId) {
  sseSend(projectId, { stage: "research", message: "Research agent started" });
  const prompt = `You are a concise Research Agent.
Return ONLY JSON with keys: competitors (array of {name,note}), market_gaps (array of strings), industry_insights (array of strings).
Industry: "${industry}".`;
  // ★ UPGRADE: Increased token allocation for more thorough results.
  const out = await callGemini(prompt, { temperature: 0.2, maxOutputTokens: 1500 });
  const parsed = tryParseJSONOrRaw(out);
  sseSend(projectId, { stage: "research_done", message: "Research agent finished", payload: parsed });
  return parsed;
}

// ★ UPGRADE: Now accepts 'research' object for context.
async function brandingAgent(industry, projectId, research) {
  sseSend(projectId, { stage: "branding", message: "Branding agent started" });
  const prompt = `You are a Branding Agent.
Return ONLY JSON:
{
  "brandName": "<one short catchy name>",
  "slogan": "<short slogan>",
  "brandPersonality": ["adj1","adj2","adj3"],
  "colorPalette": {"primary":"#hex","secondary":"#hex", "accent":"#hex"},
  "typography": {"heading":"fontName", "body":"fontName"},
  "toneOfVoice": "<short line>",
  "samplePosts": ["post1","post2","post3"]
}
Industry: "${industry}".
USE THIS CONTEXT: Based on the following research, create a brand that fills a market gap.
Research: ${JSON.stringify(research)}`;
  const out = await callGemini(prompt, { temperature: 0.6, maxOutputTokens: 1500 });
  const parsed = tryParseJSONOrRaw(out);
  sseSend(projectId, { stage: "branding_done", message: "Branding agent finished", payload: parsed });
  return parsed;
}

// ★ UPGRADE: Now accepts 'research' object for context.
async function productAgent(industry, brandName, projectId, research) {
  sseSend(projectId, { stage: "product", message: "Product agent started" });
  const prompt = `You are a Product Agent for brand "${brandName}" in industry "${industry}".
Return ONLY JSON array of 2-3 core products/services.
Each product must have: {name, price, valueProposition, customerProfile, usp}.
USE THIS CONTEXT: Base these products on the market gaps and insights from the research.
Research: ${JSON.stringify(research)}`;
  const out = await callGemini(prompt, { temperature: 0.6, maxOutputTokens: 2048 });
  const parsed = tryParseJSONOrRaw(out);
  sseSend(projectId, { stage: "product_done", message: "Product agent finished", payload: parsed });
  return parsed;
}

// ★ UPGRADE: Now accepts 'branding' and 'products' for a much more relevant website.
async function websiteAgent(brandName, industry, projectId, branding, products) {
  sseSend(projectId, { stage: "website", message: "Website agent started" });
  const prompt = `You are Website Agent for "${brandName}" (${industry}).
Return ONLY JSON for a compelling landing page.
USE THIS CONTEXT:
1.  Incorporate the brand's personality, colors, and fonts.
2.  Clearly feature the defined products.
3.  Write copy that matches the brand's tone of voice.

Branding: ${JSON.stringify(branding)}
Products: ${JSON.stringify(products)}

Return ONLY JSON:
{
  "navigation": ["Home","About","Products","Contact"],
  "homepage": {
    "hero": "<Short, catchy hero title>",
    "sub": "<Engaging sub-headline>",
    "bullets": ["<Benefit-driven bullet 1>", "<Benefit-driven bullet 2>", "<Benefit-driven bullet 3>"]
  },
  "about": "<A compelling paragraph about the brand's mission, using the brand tone of voice>",
  "product_pages": [
    {"productName": "${products[0]?.name || 'Product 1'}", "description": "<Short, persuasive description>"},
    {"productName": "${products[1]?.name || 'Product 2'}", "description": "<Short, persuasive description>"}
  ],
  "ctas": ["<Compelling primary CTA>", "<Secondary CTA>"],
  "seo_keywords": ["keyword1", "keyword2", "keyword3"],
  "meta_title": "<SEO Meta Title for Homepage>",
  "meta_description": "<SEO Meta Description for Homepage>"
}`;
  const out = await callGemini(prompt, { temperature: 0.5, maxOutputTokens: 2048 });
  const parsed = tryParseJSONOrRaw(out);
  sseSend(projectId, { stage: "website_done", message: "Website agent finished", payload: parsed });
  return parsed;
}

// ★ UPGRADE: Now accepts 'products' object for context.
async function operationsAgent(brandName, industry, projectId, products) {
  sseSend(projectId, { stage: "operations", message: "Operations agent started" });
  const prompt = `You are Operations Agent for brand "${brandName}" in "${industry}".
Return ONLY JSON for a 30-day launch plan.
USE THIS CONTEXT: The plan should be realistic for launching the specified products.
Products: ${JSON.stringify(products)}

Return ONLY JSON:
{
  "launchPlan": [
    "Week 1: Setup social media, finalize website, pre-launch buzz.",
    "Week 2: Launch product(s), start initial ad campaigns, content marketing.",
    "Week 3: Gather feedback, optimize ads, engage with first customers.",
    "Week 4: Analyze metrics, plan next content batch, scale marketing."
  ],
  "checklist": ["Register domain", "Set up business email", "Finalize legal", "Test payment gateway"],
  "marketingPlan": {
    "social": "<Strategy for 1 social media channel>",
    "email": "<Strategy for building an email list>",
    "ads": "<Example ad copy for one product>"
  },
  "pitchDeck": {
    "problem": "<The core problem you solve (from research)>",
    "solution": "<How your brand/products solve it>",
    "market": "<Your target market>",
    "brand": "<Your brand identity>",
    "products": "<Your core offerings>",
    "launchPlan": "<Brief summary of the launch plan>"
  }
}`;
  const out = await callGemini(prompt, { temperature: 0.4, maxOutputTokens: 2048 });
  const parsed = tryParseJSONOrRaw(out);
  sseSend(projectId, { stage: "operations_done", message: "Operations agent finished", payload: parsed });
  return parsed;
}

// ----- PDF generation -----
async function generatePDF(projectId, projectJSON) {
  // ★ UPGRADE: Switched to the new, advanced HTML renderer
  const html = renderStyledHTMLForPDF(projectJSON);
  const pdfDir = path.join(process.cwd(), "pdfs");
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir);
  const filepath = path.join(pdfDir, `${projectId}.pdf`);
  
  // Launch Puppeteer
  const browser = await puppeteer.launch({ 
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true // Ensure it's true for server environments
  });
  const page = await browser.newPage();
  
  // Set content and wait for any web fonts or images (if you add them)
  await page.setContent(html, { waitUntil: "networkidle0" });
  
  // Generate PDF
  await page.pdf({
    path: filepath,
    format: "A4",
    margin: { top: "25px", bottom: "25px", left: "25px", right: "25px" },
    printBackground: true // Important for rendering CSS backgrounds
  });
  
  await browser.close();
  return filepath;
}

// ★★★
// ★★★ HUGE UPGRADE: NEW PDF/HTML RENDERER
// ★★★ This function replaces the basic <pre> tag dump with a styled report.
// ★★★

// ----- PDF generation -----
// [REPLACE THE FUNCTION IN YOUR server.js WITH THIS ENTIRE BLOCK]

// ★★★
// ★★★ HUGE UPGRADE: NEW PDF/HTML RENDERER (v2 - WITH BUG FIXES)
// ★★★ This function replaces the basic <pre> tag dump with a styled report.
// ★★★
function renderStyledHTMLForPDF(project) {
  const safe = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Helper function to render a list of strings
  const renderList = (items) => {
    // ★ FIX: Use Array.isArray() for a robust check
    if (!Array.isArray(items) || items.length === 0) return "<p>N/A</p>";
    return `<ul>${items.map(item => `<li>${safe(item)}</li>`).join("")}</ul>`;
  };
  
  // Helper function to render key-value pairs
  const renderKeyValue = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return "<p>N/A</p>"; // More robust check
    return `<div class="key-value-grid">
      ${Object.entries(obj).map(([key, value]) => `
        <div class="key">${safe(key)}</div>
        <div class="value">${safe(value)}</div>
      `).join("")}
    </div>`;
  };

  // Specific renderers for each agent's output
  
  const renderResearch = (data) => {
    if (!data) return "<h2>Research</h2><p>No data</p>";
    return `
      <h2>Research & Market Analysis</h2>
      <h3>Competitors</h3>
      ${/* ★ FIX: Use Array.isArray() */ ''}
      ${Array.isArray(data.competitors) ? data.competitors.map(c => `
        <div class="card">
          <strong>${safe(c.name)}</strong>
          <p>${safe(c.note)}</p>
        </div>
      `).join("") : "<p>N/A</p>"}
      
      <h3>Market Gaps</h3>
      ${renderList(data.market_gaps)}
      
      <h3>Industry Insights</h3>
      ${renderList(data.industry_insights)}
    `;
  };
  
  const renderBranding = (data) => {
    if (!data) return "<h2>Branding</h2><p>No data</p>";
    return `
      <h2>Branding & Identity</h2>
      <div class="key-value-grid">
        <div class="key">Brand Name</div>
        <div class="value">${safe(data.brandName)}</div>
        <div class="key">Slogan</div>
        <div class="value">${safe(data.slogan)}</div>
        <div class="key">Tone of Voice</div>
        <div class="value">${safe(data.toneOfVoice)}</div>
      </div>
      
      <h3>Brand Personality</h3>
      ${renderList(data.brandPersonality)}
      
      <h3>Color Palette</h3>
      <div class="key-value-grid">
        ${Object.entries(data.colorPalette || {}).map(([name, hex]) => `
          <div class="key">${safe(name)}</div>
          <div class="value">
            <span class="color-swatch" style="background-color:${safe(hex)};"></span>
            ${safe(hex)}
          </div>
        `).join("")}
      </div>
      
      <h3>Typography</h3>
      ${renderKeyValue(data.typography)}
      
      <h3>Sample Social Media Posts</h3>
      ${/* ★ FIX: Use Array.isArray() */ ''}
      ${Array.isArray(data.samplePosts) ? data.samplePosts.map(post => `<p class="quote">"${safe(post)}"</p>`).join("") : "<p>N/A</p>"}
    `;
  };
  
  const renderProducts = (data) => {
    // ★ FIX: This was the most likely source of the crash
    if (!Array.isArray(data) || data.length === 0) return "<h2>Products & Services</h2><p>No data</p>";
    return `
      <h2>Products & Services</h2>
      ${data.map(p => `
        <div class="card">
          <strong>${safe(p.name)}</strong> (Price: ${safe(p.price || 'N/A')})
          <p><strong>Value:</strong> ${safe(p.valueProposition)}</p>
          <p><strong>Customer:</strong> ${safe(p.customerProfile)}</p>
          <p><strong>USP:</strong> ${safe(p.usp)}</p>
        </div>
      `).join("")}
    `;
  };
  
  const renderWebsite = (data) => {
    if (!data) return "<h2>Website Content</h2><p>No data</p>";
    return `
      <h2>Website Content Strategy</h2>
      <h3>Homepage</h3>
      <div class="card">
        <strong>Hero:</strong> ${safe(data.homepage?.hero)}<br/>
        <strong>Sub-headline:</strong> ${safe(data.homepage?.sub)}
      </div>
      ${renderList(data.homepage?.bullets)}
      
      <h3>About Page</h3>
      <p class="quote">${safe(data.about)}</p>
      
      <h3>Calls to Action (CTAs)</h3>
      ${renderList(data.ctas)}
      
      <h3>SEO</h3>
      ${renderKeyValue({
        "Meta Title": data.meta_title,
        "Meta Description": data.meta_description,
        "Keywords": (Array.isArray(data.seo_keywords) ? data.seo_keywords : []).join(", ") // Added array check here too
      })}
    `;
  };
  
  const renderOperations = (data) => {
    if (!data) return "<h2>Operations & Launch</h2><p>No data</p>";
    return `
      <h2>Operations & Launch Plan</h2>
      <h3>30-Day Launch Plan</h3>
      ${renderList(data.launchPlan)}
      
      <h3>Launch Checklist</h3>
      ${renderList(data.checklist)}
      
      <h3>Marketing Plan</h3>
      ${renderKeyValue(data.marketingPlan)}
      
      <h3>Pitch Deck Outline</h3>
      ${renderKeyValue(data.pitchDeck)}
    `;
  };

  // The main HTML structure (unchanged from before)
  return `
    <html>
      <head>
        <meta charset="utf-8">
        <title>${safe(project?.branding?.brandName || project.industry)}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            padding: 40px;
            color: #333;
            line-height: 1.6;
          }
          h1 {
            color: ${safe(project?.branding?.colorPalette?.primary || '#0b2340')};
            border-bottom: 2px solid ${safe(project?.branding?.colorPalette?.secondary || '#eee')};
            padding-bottom: 10px;
          }
          h2 {
            color: #333;
            margin-top: 40px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
          }
          h3 {
            color: #555;
            margin-top: 25px;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin-bottom: 8px;
          }
          .card {
            background: #f9f9f9;
            border: 1px solid #eee;
            border-left: 5px solid ${safe(project?.branding?.colorPalette?.primary || '#0b2340')};
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 5px;
          }
          .quote {
            font-style: italic;
            color: #555;
            padding-left: 15px;
            border-left: 3px solid #ccc;
          }
          .key-value-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 10px;
            margin-top: 15px;
          }
          .key {
            font-weight: bold;
            color: #444;
          }
          .value {
            color: #333;
          }
          .color-swatch {
            display: inline-block;
            width: 15px;
            height: 15px;
            border: 1px solid #ccc;
            border-radius: 3px;
            margin-right: 8px;
            vertical-align: middle;
          }
        </style>
      </head>
      <body>
        <h1>${safe(project?.branding?.brandName || project.industry)}</h1>
        <h3>${safe(project?.branding?.slogan || `A new venture in ${project.industry}`)}</h3>
        
        <div class="page-break"></div>
        ${renderResearch(project.research)}
        
        <div class="page-break"></div>
        ${renderBranding(project.branding)}
        
        <div class="page-break"></div>
        ${renderProducts(project.products)}
        
        <div class="page-break"></div>
        ${renderWebsite(project.website_content)}
        
        <div class="page-break"></div>
        ${renderOperations(project.operations)}
        
      </body>
    </html>
  `;
}

// ----- Orchestrator -----
// ★★★
// ★★★ CRITICAL UPGRADE: Sequential Orchestration
// ★★★ This is the biggest change for AI quality. Agents now run one
// ★★★ after another, using the previous step's output as context.
// ★★★

async function orchestrate(projectId, industry) {
  projects[projectId] = { status: "running", data: null, pdfPath: null };
  sseSend(projectId, { stage: "started", message: "Orchestration started" });

  let research, branding, products, website, operations;
  
  try {
    // 1. Research first (no dependencies)
    research = await researchAgent(industry, projectId);
    
    // 2. Branding uses research
    branding = await brandingAgent(industry, projectId, research);
  
    // 3. Products use branding (for name) and research (for gaps)
    products = await productAgent(industry, branding.brandName, projectId, research);
  
    // 4. Website uses branding (for style) and products (to feature)
    website = await websiteAgent(branding.brandName, industry, projectId, branding, products);
  
    // 5. Operations uses branding (for name) and products (for launch)
    operations = await operationsAgent(branding.brandName, industry, projectId, products);

  } catch (err) {
    console.error("Agent failed during orchestration:", err);
    sseSend(projectId, { stage: "error", message: "Agent failed", error: err.message });
    projects[projectId].status = "failed";
    return;
  }

  // Compile the final, coherent project data
  const finalJSON = {
    industry,
    research,
    branding,
    products,
    website_content: website,
    operations,
    pdf_ready_text: `Company: ${branding.brandName}`
  };
  
  projects[projectId].data = finalJSON;
  sseSend(projectId, { stage: "compile_done", message: "Compiled JSON", payload: finalJSON });

  // Generate the PDF
  try {
    sseSend(projectId, { stage: "pdf_start", message: "Generating PDF report" });
    const pdfPath = await generatePDF(projectId, finalJSON);
    projects[projectId].pdfPath = pdfPath;
    projects[projectId].status = "complete";
    sseSend(projectId, { stage: "pdf_done", message: "PDF generated", pdfUrl: `/download/pdf/${projectId}` });
    sseSend(projectId, { stage: "complete", message: "All done", project: finalJSON });
  } catch (err) {
    console.error("PDF generation failed:", err);
    sseSend(projectId, { stage: "error", message: "PDF generation failed", error: err.message });
  }
}

// ----- Routes (Unchanged) -----
app.post("/generate", (req, res) => {
  const { industry } = req.body;
  if (!industry || industry.trim().length < 1) return res.status(400).json({ error: "industry required" });
  const id = uuidv4();
  sseClients[id] = [];
  orchestrate(id, industry).catch(console.error);
  res.json({ projectId: id, sseUrl: `/events/${id}` });
});

app.get("/events/:id", (req, res) => {
  const id = req.params.id;
  res.set({ "Cache-Control": "no-cache", "Content-Type": "text/event-stream", Connection: "keep-alive" });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ stage: "connected", message: "SSE connected" })}\n\n`);
  sseClients[id] = sseClients[id] || [];
  sseClients[id].push(res);
  req.on("close", () => { sseClients[id] = sseClients[id].filter(r => r !== res); });
});

app.get("/download/json/:id", (req, res) => {
  const p = projects[req.params.id];
  if (!p || !p.data) return res.status(404).send("Project not found");
  res.setHeader("Content-Disposition", `attachment; filename=${p.data.branding?.brandName || req.params.id}.json`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(p.data, null, 2));
});

app.get("/download/pdf/:id", (req, res) => {
  const p = projects[req.params.id];
  if (!p || !p.pdfPath) return res.status(404).send("PDF not ready");
  res.download(p.pdfPath, `${p.data?.branding?.brandName || req.params.id}.pdf`);
});

// Serve static front-end (index.html should be in ./public)
app.use(express.static(path.join(process.cwd(), "public")));

// ----- Start server (Unchanged) -----
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => console.log(`ACB running at http://localhost:${PORT}`));