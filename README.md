# Autonomous Company Builder (ACB)

**Autonomous Company Builder (ACB)** is a Node.js project that automatically generates a complete, ready-to-use business concept using Google Gemini 2.5 AI. It orchestrates the AI to produce deep research insights, comprehensive branding, viable product ideas, website content, and operations plans. The final output includes downloadable JSON and PDF reports.

---

## ✨ Features

* Generates an entire company plan from a single industry input.
* Uses Google Gemini 2.5 AI for:

  * Market research and deep insights.
  * Branding (brand name, slogan, personality, color palette, etc.).
  * Product ideas with clear Unique Selling Propositions (USPs).
  * Website content (navigation, hero section, detailed pages).
  * Operations and marketing plans.
* Real-time streaming updates using Server-Sent Events (SSE).
* Downloadable JSON and PDF reports of the complete company plan.
* Ready-to-use frontend with a single HTML file (`public/index.html`).

---

## 🛠️ Installation

Follow these steps to set up and run the project locally.

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/autonomous-company-builder.git
cd autonomous-company-builder
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set module type in `package.json`

Make sure your `package.json` contains the following so ES module syntax is enabled:

```json
{
  "type": "module"
}
```

### 4. Set your Google Gemini API key

Replace `YOUR_API_KEY` with your actual key in your environment.

**Environment**

**Windows PowerShell**

```powershell
$env:GEMINI_API_KEY="YOUR_API_KEY"
```

**Windows CMD**

```cmd
set GEMINI_API_KEY=YOUR_API_KEY
```

**macOS / Linux**

```bash
export GEMINI_API_KEY="YOUR_API_KEY"
```

---

## 🚀 Usage

1. Start the server:

```bash
node server.js
```

2. Open the frontend in your browser:

```
http://localhost:3000
```

3. Generate a company:

* Enter an industry (e.g., `sustainable clothing` or `AI-powered education`) into the input field.
* Click **Generate Company**.
* Watch the streaming updates in real time on the page.
* Once generation is complete, use the links to **Download JSON** or **Download PDF**.

---

## 📂 Project Structure

```
autonomous-company-builder/
│
├─ public/
│  └─ index.html     # Frontend file for the user interface
│
├─ pdfs/             # Generated PDFs stored here
│
├─ server.js         # Node.js server with AI orchestration logic
├─ package.json      # Project dependencies and metadata
└─ README.md         # This file
```

---

## 📦 Dependencies

This project relies on the following key technologies:

* Node.js
* Express (Web framework)
* body-parser (Middleware)
* cors (Middleware)
* uuid (Unique identifier generation)
* puppeteer (For headless Chromium PDF generation)
* `@google/generative-ai` (Official Google Gemini SDK)

---

## 📌 Notes

* **API Key:** Requires a valid Google Gemini 2.5 API key.
* **PDF Generation:** PDF creation is handled by Puppeteer, which manages a headless version of Chromium.

### API Endpoints

* **SSE endpoint:** `/events/:projectId` — streams live updates to the client.
* **JSON download:** `/download/json/:projectId`
* **PDF download:** `/download/pdf/:projectId`

---

## 📝 License

This project is licensed under the **MIT License**.

---

## ✍️ Author

**Nasif Sajjad**

---

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to open a pull request or an issue in the repository.

---

*Happy building!* 🚀
