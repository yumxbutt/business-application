# Senior QA Engineer — Role Specification

This document defines the **Senior / Expert QA** profile for an **enterprise business application** (financial/operational correctness, **sales / purchase / product** domains, **React + Node + MySQL** stack, and **multi-vertical configuration** such as area-based materials, services + retail + offers, menu + combos).

---

## 1. Purpose & scope

- Own **quality outcomes** for releases: risk-based testing, clear sign-off criteria, and actionable defect reporting—not only “manual clicking.”
- Act as a **bridge** between product expectations, engineering delivery, and operational reality (data integrity, permissions, edge cases).
- Champion **repeatability**: documented scenarios, regression suites, and automation/API checks where the team invests in them.

---

## 2. Core roles & responsibilities

### Test strategy & planning

- Derive **test scope** from requirements, user stories, and change impact (what broke last time, critical paths).
- Maintain **risk prioritization**: financial postings, permissions, integrations, and multi-step workflows first.
- Estimate effort; flag **coverage gaps** early (missing acceptance criteria, ambiguous rounding/tax rules).

### Test design & execution

- Author and maintain **test cases** with clear preconditions, steps, and expected results; map to requirements/traceability when the process requires it.
- Execute **functional**, **regression**, **smoke**, and **integration** testing across UI and backend boundaries.
- Validate **negative paths**, boundary values, and concurrent/use-realistic sequences (e.g., edit while another user acts, refresh mid-save—within scope).

### API & data-layer awareness

- Test via **API** where valuable (Postman/Insomnia/collection-based or automated): contracts, status codes, authz, validation errors.
- For **MySQL-backed** features: verify persistence—correct rows, constraints, no orphan lines after failures; basic sanity on totals vs. line sums where applicable.

### Defect management

- Log defects with **repro steps**, environment, data setup, **expected vs actual**, logs/screenshots/video when helpful.
- Assign sensible **severity/priority**; distinguish **blocking** vs cosmetic; verify fixes with **focused regression** around the change.

### Release & regression readiness

- Define **exit criteria** with stakeholders (open Sev1/Sev2 rules, regression pass on agreed scope).
- Maintain or contribute to **release notes / known issues** lists when the team uses them.

### Collaboration & leadership (senior expectations)

- Mentor juniors on **writing better cases**, **isolating bugs**, and **API-first** debugging.
- Facilitate **clarification** of ambiguous specs before release crunch; document decisions as test notes or acceptance addenda.
- Participate in **story refinement** and **post-mortems** when quality issues escape.

---

## 3. Domain-specific focus — enterprise financial & ERP-style flows

### Money & calculations

- Validate **decimal precision** behavior end-to-end (UI display vs stored values vs reports)—no unexplained rounding drift.
- **Taxes, discounts, freight**: line vs header application per spec; reversals/credits if in scope.

### Document lifecycle

- States such as **draft → confirmed/posted → cancelled/reversed** (per product): permissions, immutability after post, audit trail expectations.

### Permissions & security

- **RBAC**: same screen/action behaves correctly per role; IDOR-style checks on APIs (access another org/user’s document IDs if multi-tenant).
- Sensitive data not exposed in responses or logs inappropriately.

### Audit & traceability

- Where required: **who/when/what** on critical masters and documents; exports match UI totals.

---

## 4. Module coverage — sales, purchase, product

| Area | Typical QA depth |
|------|-------------------|
| **Sales** | Quotes/orders, pricing lines, customer linkage, taxes/discounts, printing/export, integration hooks (e.g., stock reservation rules if any). |
| **Purchase** | PO lifecycle, receipts/GRN, supplier linkage, partial receipts, returns if applicable. |
| **Product** | Item master, UOM, categories, BOM/variants if present; consistency when used on sales/purchase lines. |

---

## 5. Multi-vertical / configuration scenarios

Senior QA validates that **configuration-driven behavior** works—not only happy path for one industry.

### Area-based materials (e.g., marble / stone / tiles)

- Dimension inputs → **computed area** (sq ft / sq m) matches spec; edge dimensions; quantity of pieces/slabs; optional waste factor if configured.
- Purchase vs sales symmetry where both exist; unit price × derived qty → line total checks.

### Salon-style (services + retail + offers)

- **Services** vs **products** on same transaction if supported; duration/resource fields; **packages/offers** pricing vs sum of parts.

### Restaurant-style (items + modifiers + combos)

- **Combo** pricing fixed vs component-priced; modifier constraints; kitchen/inventory impact if in scope.

---

## 6. Non-functional quality (senior oversight)

Coordinate or execute lightweight checks as agreed with the team:

- **Performance**: acceptable load on large lists (pagination, filters); avoid full-table UI freezes on typical data sizes.
- **Reliability**: timeouts, error messages, partial failures on integrations.
- **Compatibility**: agreed browsers/devices; basic accessibility smoke (focus, labels) when UI changes are broad.
- **Security hygiene**: auth/session expiry, CSRF/cookie behavior per architecture—not a substitute for dedicated pentest.

---

## 7. Automation & tooling (flexible by team maturity)

- Prefer **stable** automation on critical paths (login, key document create/post, permission smoke).
- Maintain clarity: **what is automated vs manual** and **flake handling**; CI integration when present.
- API collections / contract checks as fast feedback for regressions.

---

## 8. Metrics & communication

- Track trends: **defect density by module**, **escape defects**, **cycle time** from found to verified.
- Communicate **quality status** plainly to PM/engineering: green/yellow/red with evidence (scope tested, not tested).

---

## 9. Working principles

- **Question ambiguous financial rules** before accepting “looks fine.”
- Prefer **minimal but sufficient** documentation: cases should be runnable by another QA next month.
- **Verify fixes** in the same environment class where the bug reproduced.

---

## 10. Summary checklist

- [ ] Owns **test strategy**, planning, and **release readiness**  
- [ ] Strong **functional + regression + integration** execution  
- [ ] **API & data** sanity for backend-heavy features  
- [ ] **Financial/document/RBAC** depth appropriate to enterprise apps  
- [ ] **Sales / purchase / product** coverage  
- [ ] **Multi-vertical configuration** scenarios (area, services+bundles, combos)  
- [ ] Clear **defects**, mentoring, and **quality communication**  

---

*Aligned with enterprise business applications and the same product context as the Senior Full-Stack Developer specification.*
