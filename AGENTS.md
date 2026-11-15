# AGENTS.md — AI Coding Agent & Parallel Team Operating Protocol

> **⚠️ MANDATORY READ FOR ALL AI AGENTS & DEVELOPERS**  
> This repository is under active, parallel development by **The A-Team** (Montréal Local Event) for the **2026 NASA International Space Apps Challenge (November 14–15, 2026)** on the challenge **"Harmonization of MODIS and VIIRS Hot Spots."**  
> Every AI agent must strictly follow the synchronization, mathematical rigor, and NASA fair-use rules below before modifying any file.

---

## 📚 1. Source of Truth: Master Engineering Plan (Google Docs)

Before writing or refactoring any backend or frontend code, **you must consult the Team Master Plan Google Doc**, which contains the step-by-step architecture, physical equations, Locked Data Contract tables, and reference Python/TypeScript snippets:

- **🔗 Team Master Plan (Google Docs — 6 Tabs):** `[INSERT_GOOGLE_DOCS_MASTER_PLAN_LINK_HERE]`
  - **Tab 1:** *Master Overview — Planning Backend, Planning Frontend & Official NASA/Partner Datasets*
  - **Tab 2:** *Task to Assign & Complete — Backend: Innovation A ("SuperRes-Fire" + Uber H3 + 9 Physical Freebies)*
  - **Tab 3:** *Task to Assign & Complete — Backend: Innovation B ("Optical Wait-Time Bridge"), Innovation C ("Live 3D SGP4 Orbital Tracker"), Innovation D ("Constrained 7-Role Local LLM & Citizen Chatbot") & BFF Layer*
  - **Tab 4:** *Task to Assign & Complete — Frontend: Web Interface, Locked Data Contract Table, Usability Rubric & Accessibility*
  - **Tab 5:** *Official Submission Guidelines, Judging Rubric Strategy & 7-Slide Pitch Blueprint*
  - **Tab 6:** *Master Execution & Triage Checklist (Mirrored in `README.md`)*

*(If you are running in a local CLI environment without browser access to Google Docs, check `./docs/` or ask the developer to paste the relevant Tab section from the Google Doc into your context window before coding.)*

---

## 🔄 2. Anti-Collision Git & Checklist Workflow (Never Duplicate Work!)

Multiple teammates and AI agents are working simultaneously across Backend and Frontend tasks. To avoid stepping on each other's toes or building the same feature twice, **follow this exact 5-step loop for every single task**:

### Step 1: Pull the Latest `dev` Branch First
Always synchronize with `origin/dev` before reading the checklist so you see what other teammates and agents have just finished:
```bash
git checkout dev
git fetch origin dev
git pull origin dev