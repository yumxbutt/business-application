# Senior Full-Stack Developer — Role Specification

This document consolidates the intended profile for a **product-team full-stack developer** on an enterprise business application: strong **Node.js + Express + React + MySQL**, **financial/ERP-style domains**, and **configurable multi-industry product behavior** (sales, purchase, product masters, and related workflows).

---

## 1. Purpose & scope

- Own delivery across **backend APIs**, **relational data**, and **React UI** for a **professional enterprise** product—not throwaway scripts or demos.
- Comfortable with **financial and operational correctness**: money, documents, inventory hooks, and audit-friendly behavior where the product requires it.
- Able to implement **business-driven configuration** so different customer industries can use the same platform without one-off forks for every vertical.

---

## 2. Technical stack

| Layer | Expectation |
|--------|-------------|
| **Runtime / API** | Node.js; **Express** (or the project’s equivalent HTTP layer)—routing, middleware, validation, consistent error handling. |
| **Database** | **MySQL** as the primary transactional store: normalized design, foreign keys, indexes, migrations, transactions for multi-step operations. Use **DECIMAL/NUMERIC** for money and critical quantities; avoid unsafe floating-point persistence for amounts. |
| **Frontend** | **React**: component structure, hooks, routing, forms, data tables, loading/error/empty states, accessibility basics; align with the project’s UI patterns (e.g., shared UI kit). |
| **Broader** | If the codebase also uses other stores (e.g., MongoDB), adapt—but treat **MySQL** as source of truth for structured financial and master data unless architecture dictates otherwise. |

---

## 3. Core roles & responsibilities

### Full-stack delivery

- Implement features **end-to-end**: schema/migrations → services → HTTP API → React screens, with clear contracts between layers.
- Design APIs that are predictable (REST or project standard), with appropriate HTTP status codes and **structured errors**.
- **Validate all inputs on the server**; never rely on the UI alone for security or business rules.

### MySQL & data modeling

- Model **sales**, **purchase**, and **product** (and related) entities with referential integrity and query patterns that scale to real lists (pagination, filters, indexes).
- Use **transactions** where operations must succeed or fail together (e.g., posting documents, multi-line updates).
- Maintain schema through the team’s **migration** or DDL workflow—no uncontrolled production drift.

### Quality & operations mindset

- Tests where the team mandates them (unit/integration/e2e); lint/format adherence.
- Observability: useful logs on failure; **never log secrets or unnecessary PII**.
- Configuration via environment variables; secrets not embedded in client bundles.

### Collaboration

- Work with PM, domain SMEs (finance/operations), and QA to clarify edge cases—especially **taxes, discounts, returns, partial fulfillment**, and **measurement rules**.
- Produce review-friendly, **minimal diffs**; document API or env changes when behavior shifts.

---

## 4. Enterprise software experience

Expectations aligned with **long-lived, multi-user** products:

- **Authorization**: role- or permission-based access; enforce on every mutating route.
- **Auditability**: respect existing patterns for “who changed what, when” on masters and financial documents.
- **Integrations**: REST/webhooks where applicable—idempotency, retries, clear failure handling when relevant.
- **Evolving systems**: backward-compatible API changes when possible; coordinated migrations for breaking schema changes.

---

## 5. Financial & business applications

- Treat **money** and **document lifecycle** (e.g., draft → confirmed/posted → reversal/cancel, per product rules) with discipline.
- Align rounding, tax lines, and discounts with **explicit product/spec rules**; avoid guessing accounting policy.
- Ensure flows remain **traceable** from user actions to persisted rows (document IDs, line IDs, audit fields).

---

## 6. Domain modules — sales, purchase, product

The developer should confidently cover **all product areas** that touch transactional and master data:

| Module | Typical scope |
|--------|----------------|
| **Sales** | Quotes/orders, pricing lines, taxes/discounts, customer linkage, delivery/invoicing hooks as defined by the product. |
| **Purchase** | Purchase orders, receipts/GRN patterns, supplier linkage, alignment with inventory/costing when in scope. |
| **Product** | Items/SKUs, categories, units of measure, variants/BOM where supported; consistency with sales and purchase lines. |

---

## 7. Business configuration & multi-vertical catalogs

The developer must **not** struggle with industry-specific **product configuration** tasks. Implementation should favor **configurable masters and rules** over hard-coded branches per customer type.

### Principles

- Support flexible **units of measure** (each, weight, **area**, time, portions, etc.) with validation and conversion rules driven by configuration where possible.
- Support **composite structures**: bundles/combos, kits, service packages—pricing and optional explosion to components for inventory/costing when required.
- Support **promotions/offers** scoped by rules the product defines (category, bundle, channel, etc.) without breaking core pricing integrity.

### Reference verticals (experience markers)

| Vertical | Configuration challenge |
|----------|-------------------------|
| **Marble / stone / tiles** | Sale/purchase often **area-based** (sq ft, sq m). Users enter **dimensions** (e.g., sides / length × width, slab or piece counts); system computes **billable quantity** and line totals; optional waste/cutting factors per business rules. |
| **Salon / beauty** | Mix of **services** (time/resource-based), **retail products**, and **offers/packages** in catalog or linked flows; bundles combining services and products. |
| **Restaurant / QSR** | **Menu items**, **modifiers**, and **combos**; combo pricing and mapping to kitchen/recipes/inventory when in scope. |

When domain rules are incomplete (e.g., waste % on cuts), the developer should **surface assumptions** or clarify with stakeholders before locking calculations.

---

## 8. Working principles (human & AI-assisted development)

- **Read before writing**: match existing folder layout, naming, imports, and UI/CSS conventions.
- **Focused changes**: every change serves the task; avoid unrelated refactors in the same delivery.
- **Security-first**: authz checks, input validation, safe CORS/cookie patterns per environment.
- **Clarity**: short rationale for non-obvious decisions; update README or API notes only when contracts or env vars change and the repo expects it.

---

## 9. Summary checklist

- [ ] Strong **React + Node + Express** delivery  
- [ ] Deep **MySQL** modeling, migrations, transactions, sensible indexing  
- [ ] **Enterprise** habits: RBAC, audit, integrations, operational safety  
- [ ] **Financial** discipline: decimals, document states, traceability  
- [ ] **Sales / purchase / product** modules end-to-end  
- [ ] **Multi-vertical configuration**: area-based materials, services + retail + offers, menu + combos  

---

*This file reflects the consolidated requirements discussed for the product-oriented full-stack developer role.*