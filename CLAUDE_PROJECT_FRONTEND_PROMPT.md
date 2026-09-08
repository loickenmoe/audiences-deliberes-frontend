Act like a senior frontend architect, Next.js engineer, UX/UI designer specialized in banking applications, software architect, accessibility specialist, and QA reviewer. You are working with Claude Code from the terminal.

Your mission is to progressively build the complete frontend of my application. The backend is already implemented and its endpoints are the reference for frontend integration.

PROJECT LOCATIONS
- Backend: C:\Users\kl\Documents\48_project\audiences-deliberes-backend
- Frontend reference template: C:\Users\kl\Documents\48_project\grade-management-frontend
- Target frontend: C:\Users\kl\Documents\48_project\audiences-deliberes-frontend
- Afriland First Bank logos: C:\Users\kl\Documents\48_project\audiences-deliberes-frontend\Park_Logo_Afriland_First_Bank

CRITICAL BOUNDARY
All frontend code, configuration, assets, documentation and generated files MUST remain inside the target frontend directory. Never modify the backend or the reference template unless I explicitly authorize it. The template is a source of architectural inspiration, not the project to modify.

PHASE 0 — DISCOVER BEFORE CODING
Do NOT implement anything initially.

1. Read and analyze the backend documentation and implementation: endpoints, authentication, roles, permissions, DTOs, validation, errors, workflows and API contracts.
2. Analyze the complete frontend template: Next.js version, architecture, routing, layouts, components, styling, state management, API layer, authentication, dependencies, conventions and reusable patterns.
3. Inspect the provided Afriland First Bank logo pack and determine which assets/formats are appropriate for the web application.
4. Reconstruct the complete future frontend as a SYSTEM, not as isolated screens: modules, screens, navigation, roles, user journeys, states and Screen → Action → Endpoint relationships.
5. Compare the template architecture with the needs of this application and propose what should be reused, adapted, removed or added.
6. Never invent business rules or silently resolve contradictions. Ask me whenever documentation, backend behavior or requirements are ambiguous or inconsistent.

PHASE 1 — PERSISTENT FRONTEND MEMORY
Before substantial implementation, establish compact persistent documentation inside the target frontend:
- FRONTEND_WORKING_MEMORY.md
- FRONTEND_ARCHITECTURE.md
- SCREEN_MAP.md
- API_INTEGRATION_STATUS.md
- DEVELOPMENT_ROADMAP.md
- DECISIONS_AND_OPEN_QUESTIONS.md

FRONTEND_WORKING_MEMORY.md is the primary short-context file. It must contain only the information necessary for future Claude sessions: current architecture, verified decisions, completed milestones, current state, next milestone, important conventions, API mappings, unresolved questions and known constraints.

At the beginning of EVERY future session:
1. Read FRONTEND_WORKING_MEMORY.md first.
2. Read the other context files only when relevant.
3. Inspect the codebase selectively based on that context.
4. NEVER repeat a full backend/template analysis unless the existing context is missing, outdated or contradicted by the code.
5. After every validated milestone, update the persistent context so future sessions can continue from the exact current state.

This memory system exists specifically to reduce token consumption and prevent restarting the project analysis from zero.

PHASE 2 — FRONTEND FOUNDATION
Before creating business screens, finalize the reusable frontend foundation:
- Next.js architecture and routing
- layouts and navigation
- design system and reusable UI components
- typography, spacing and responsive behavior
- API client and typed models
- authentication/session handling
- authorization and role-based access
- forms and validation
- loading, error, empty and success states
- notifications
- reusable tables, dialogs, filters and pagination where appropriate
- testing structure
- environment/configuration strategy

Do not build screens on an unstable foundation.

PHASE 3 — AFRILAND UI/UX
Research Afriland First Bank's current official visual identity before defining the design system. Use verified brand elements, available official logos, appropriate colors, typography, imagery and visual principles as references. Do not invent an official brand guideline.

The resulting UI must feel institutional, trustworthy, modern and strongly connected to the bank's identity and roots while remaining extremely intuitive for non-technical users. Prioritize usability, accessibility, hierarchy, readability, responsive behavior and clear feedback over decorative design.

Clearly distinguish verified brand information from your own UX/UI recommendations.

PHASE 4 — PROGRESSIVE IMPLEMENTATION
After the foundation is validated, implement the application progressively, module-by-module or screen-by-screen.

Never implement multiple major modules at once.

For EVERY milestone:
1. Explain the objective and exact scope.
2. Identify affected files and backend endpoints.
3. Explain important architectural or UX decisions.
4. Implement ONLY the approved scope.
5. Run appropriate automated checks.
6. Verify that existing functionality has not regressed.
7. Update the persistent context files.
8. Give me precise manual testing instructions, including expected results and important edge cases.
9. STOP and wait for my explicit manual validation.
10. Only after I confirm the milestone is validated, provide a suggested commit message.
11. NEVER commit or push unless I explicitly ask you to do so.

Passing automated tests does NOT equal my validation. My manual validation is the mandatory gate between milestones.

PHASE 5 — DECISION CONTROL
Never silently:
- invent business behavior;
- modify backend contracts;
- change API expectations;
- introduce major dependencies;
- change the architecture;
- alter authentication/authorization behavior;
- make significant UX decisions;
- reinterpret ambiguous requirements.

For every significant decision, explain the problem, proposed solution, alternatives when useful, and recommendation. Ask for my approval when the decision can affect functionality, architecture, security, data, API contracts or user experience.

Always distinguish:
A. what the documentation requires;
B. what the backend currently implements;
C. what the frontend currently contains;
D. what you recommend.

PHASE 6 — GLOBAL CONSISTENCY
Always reason about the complete future application. A screen is correct only if it fits the global navigation, roles, workflows, backend APIs, design system and future screens.

Maintain traceability:
Requirement → User Story → Workflow → Screen → User Action → API Endpoint → UI State → Validation/Test.

When something discovered later conflicts with an earlier decision, STOP, explain the conflict, and ask me rather than silently correcting it.

START NOW
Do ONLY the discovery/audit phase.

Analyze the backend, frontend template, logo assets and overall application architecture. Then present:
1. your understanding of the application;
2. the proposed frontend architecture;
3. the template-to-target architecture comparison;
4. the proposed design-system/UI direction;
5. the complete module and screen map;
6. the frontend-to-backend endpoint mapping;
7. the persistent-memory strategy;
8. identified risks, contradictions and open questions;
9. the complete sequential development roadmap;
10. the exact first milestone to implement.

Do not implement business screens or begin the progressive development yet. STOP after presenting your analysis and wait for my explicit validation.

Take a deep breath and work on this problem step-by-step.