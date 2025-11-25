Autonomous Company Builder (ACB)

Autonomous Company Builder (ACB) is a Node.js project that automatically generates a complete business concept using Google Gemini 2.5 AI. It produces research insights, branding, product ideas, website content, operations plans, and generates downloadable JSON and PDF outputs. The frontend streams updates in real time via Server-Sent Events (SSE).

Features

Generates an entire company plan from a single industry input.

Uses Google Gemini 2.5 AI for:

Market research

Branding (brand name, slogan, personality, color palette, etc.)

Product ideas with USP

Website content (navigation, hero section, pages)

Operations and marketing plans

Real-time streaming updates using SSE.

Downloadable JSON and PDF reports.

Ready-to-use frontend with a single HTML file.

Demo Screenshot

(Add screenshot here if you like)

Installation

Clone the repository:

git clone https://github.com/yourusername/autonomous-company-builder.git
cd autonomous-company-builder


Install dependencies:

npm install


Set module type in package.json:

Ensure your package.json contains:

{
  "type": "module"
}


Set your Google Gemini API key:

Replace YOUR_API_KEY with your actual key.

Windows PowerShell:

$env:GEMINI_API_KEY="YOUR_API_KEY"


Windows CMD:

set GEMINI_API_KEY=YOUR_API_KEY


macOS / Linux:

export GEMINI_API_KEY="YOUR_API_KEY"

Usage

Start the server:

node server.js


Open your browser and go to:

http://localhost:3000


Enter an industry and click Generate Company.

Watch the streaming updates in real time.

Download JSON or PDF once generation completes.

Project Structure
autonomous-company-builder/
│
├─ public/
│  └─ index.html       # Frontend file
│
├─ pdfs/               # Generated PDFs stored here
├─ server.js           # Node.js server with AI orchestration
├─ package.json
└─ README.md

Dependencies

Node.js

Express

body-parser

cors

uuid

puppeteer

@google/generative-ai

Notes

Requires a valid Google Gemini 2.5 API key.

PDF generation uses Puppeteer (headless Chromium).

SSE endpoint: /events/:projectId streams live updates.

JSON download endpoint: /download/json/:projectId

PDF download endpoint: /download/pdf/:projectId

License

This project is licensed under the MIT License.

Author

Nasif Sajjad
