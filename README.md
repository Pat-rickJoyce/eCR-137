# eCeleRate (eCR-137)

> A standalone, browser-based tool for authoring and generating HL7 CDA R2 electronic Case Reporting (eCR) documents for testing purposes.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Working with the Form — Templates](#3-working-with-the-form--templates)
4. [Generating Documents](#4-generating-documents)
5. [Understanding the Reportability Determination](#5-understanding-the-reportability-determination-)
6. [RCTC Code Search](#6-rctc-code-search)
7. [Document Versioning](#7-document-versioning)
8. [Tips & Known Considerations](#8-tips--known-considerations)

---

## 1. Overview

**eCeleRate** is a single-page web application for building complete electronic Initial Case Reports (eICR) and Reportability Responses (RR) according to the HL7 CDA R2 eCR standard. 

The tool is aimed at:

- **Public health informaticists** testing eCR workflows and data quality rules
- **HL7 implementers** exploring eICR and RR document structure
- **Developers and integrators** who need realistic, schema-valid CDA documents for testing pipelines

### What eCeleRate produces

| Output | Format | Description |
|--------|--------|-------------|
| eICR | CDA R2 XML | The electronic Initial Case Report |
| RR | CDA R2 XML | The Reportability Response |
| ZIP package | `.zip` | Both documents as XML + XSLT-rendered HTML, plus a metadata file |

### Patient Snapshot Card

At the top of the form, a live **patient snapshot card** summarizes the current document state, displaying real-time counts of diagnoses, problems, and lab entries. The counts update as you add or remove entries, giving you a quick at-a-glance view of document completeness.

---

## 2. Getting Started

### Use the live tool

Open the app directly in your browser — no installation required:

**[https://pat-rickjoyce.github.io/eCR-137/](https://pat-rickjoyce.github.io/eCR-137/)**

A Chromium-based browser (Chrome or Edge) is strongly recommended. See [Tips & Known Considerations](#8-tips--known-considerations) for browser notes.

### Clone the repository (for customization)

If you want to modify built-in templates, change the ZIP output structure, adjust XSLT stylesheets, or make other local changes, clone the repository and open `index.html` directly:

```bash
git clone https://github.com/Pat-rickJoyce/eCR-137.git
cd eCR-137
# Open index.html in Chrome or Edge
```

> **No build step or local server is required.** Simply open `index.html` in a Chromium-based browser. Firefox may have limitations with the `file://` protocol and XSLT rendering; Chrome or Edge is preferred for local use.

---

## 3. Working with the Form — Templates

eCeleRate supports four template workflows: starting from the built-in defaults, building on the pre-populated sample case, loading a saved template, or saving your current state for later.

### Start from New

On every page load (or after a browser refresh), the form initializes with built-in **default sample data** — a fictional patient named **Emma Rose Johnson**, treated at **Grand Republic Medical Facility Clinic**, with an encounter date of **2024-06-15**. This is intentional: the defaults ensure the form is always in a valid, document-ready state so you can immediately generate output and explore the structure.

To start a fresh case, simply clear or overwrite the pre-populated fields.

### Start from a Built-in Template

The initialization script ([js/initialization.js](js/initialization.js)) pre-populates the form with a realistic sample case on load, including diagnoses, lab results, medications, and other clinical detail. Use this as a reference when learning the document structure or as a starting point to modify for your own scenario.

### Load a Saved Template

Click **Load Form Data** in the floating action dock. This opens a file picker that accepts `.json` files. Selecting a previously saved template file restores:

- All patient demographics and administrative fields
- Repeating section entries (diagnoses, problems, labs, medications, immunizations, procedures)
- Document metadata (Set ID, version number, encounter details)

The form will be fully repopulated, exactly as it was when the template was saved.

#### Authoring and Editing Templates Directly

You do not have to use the form UI to create a template — you can author or edit `.json` template files by hand. This is useful for building a library of pre-configured test cases, automating template generation, or making bulk changes without navigating the form.

**JSON structure overview**

A template file is a flat JSON object. Simple scalar fields (patient name, encounter date, etc.) are top-level key-value pairs. Repeating sections are represented as arrays of objects, where each object in the array corresponds to one row in that section of the form.

The repeating section array keys are:

| Array key | Corresponds to |
|-----------|---------------|
| `diagnosisEntries` | Diagnoses section rows |
| `problemEntries` | Problems section rows |
| `labEntries` | Lab Orders and Results rows |
| `medicationEntries` | Medications (Administered) rows |
| `immunizationEntries` | Immunizations rows |
| `procedureEntries` | Procedures rows |

**Example: a single diagnosis entry**

Each object in `diagnosisEntries` uses the following fields:

```json
{
  "diagnosisEntries": [
    {
      "code": "840539006",
      "name": "Disease caused by severe acute respiratory syndrome coronavirus 2",
      "codeSystem": "SNOMED",
      "diagnosisDate": "2024-06-15",
      "onsetDate": "2024-06-10",
      "status": "active"
    }
  ]
}
```

**Example: a single problem entry**

Each object in `problemEntries` uses:

```json
{
  "problemEntries": [
    {
      "code": "73211009",
      "name": "Diabetes mellitus",
      "onsetDate": "2019-01-01",
      "concernStatus": "active"
    }
  ]
}
```

**Building a case library**

Because templates are plain `.json` files, you can maintain a collection of them in version control — one file per test scenario. Scenarios can share a common patient base and vary only in their diagnosis, lab, or medication arrays, making it straightforward to cover a range of reportability conditions without re-entering data through the form each time.

### Save a Template

Click **Save Form Data** in the floating action dock. This serializes the entire current form state — including all repeating section entries — into a `.json` file downloaded to your machine. The file can be reloaded in any future session using **Load Form Data**, shared with colleagues, or version-controlled alongside your testing workflows.

---

## 4. Generating Documents

All generation actions are accessible from the **floating action dock** at the bottom of the screen. Required field validation runs before any document is generated; if validation fails, the form will highlight the missing fields.

### Generate eICR

Click **Generate eICR** to build a CDA R2-compliant electronic Initial Case Report XML document and download it to your machine. The filename is generated dynamically based on patient and document metadata.

In Chromium-based browsers, you will be prompted to choose a save location via the File System Access API. In other browsers, the file downloads directly to your default Downloads folder.

### Generate RR

Click **Generate RR** to build a CDA R2-compliant Reportability Response XML document. The RR reflects the reportability determination for the diagnoses present in the form. See [Section 5](#5-understanding-the-reportability-determination-) for details on what drives that determination.

As with the eICR, Chromium-based browsers offer a save-location dialog; other browsers download directly.

### Generate Both (ZIP)

Click **Generate Both (ZIP)** to package the eICR and RR together in a single archive. The ZIP contains five files:

| File | Description |
|------|-------------|
| `eICR_<patient>_<setId>_<date>.xml` | eICR CDA R2 XML document |
| `RR_<patient>_<setId>_<date>.xml` | RR CDA R2 XML document |
| `eICR_<patient>_<setId>_<date>.html` | eICR rendered to HTML via XSLT (CDAR2_eCR_eICR-2.xsl) |
| `RR_<patient>_<setId>_<date>.html` | RR rendered to HTML via XSLT (CDAR2_eCR_RR.xsl) |
| `metadata.xml` | Package metadata: facility name and ID, organization, sender, ZIP filename |

The base filename for all files is constructed from the patient name, Set ID, and today's date (`<PatientName>_<SetId>_<YYYY-MM-DD>`). The outer ZIP filename is generated dynamically using the same facility/patient metadata.

The HTML files provide human-readable CDA renderings using the same XSLT stylesheets used by eCR viewers, making the ZIP useful for direct review without a separate CDA renderer.

> **Note:** ZIP generation requires XSLT transformation, which relies on the browser's built-in XML/XSLT engine. This works most reliably in Chromium-based browsers.

---

## 5. Understanding the Reportability Determination ⚠️

eCeleRate contains two distinct but related components that together drive how reportability is expressed in the tool: the **bundled rules engine** (which evaluates form data in real time and powers the in-app reportability badge and panel), and the **RR generator** (which produces the RR XML document for download). Understanding both — and their relationship — is important for interpreting what the tool tells you.

### The bundled rules engine

The rules engine ([js/reportability-engine/bundle.js](js/reportability-engine/bundle.js)) runs continuously in the background as you fill out the form. It evaluates the full clinical record against a library of embedded condition rules, and updates the reportability badge and detail panel in real time.

**What the engine evaluates**

The engine is meaningfully multi-dimensional. For each reportable condition in its rule library, it evaluates criteria across several clinical data types simultaneously, using AND-logic across criteria groups and OR-logic within each group:

| Data type | Form source | Notes |
|-----------|------------|-------|
| Diagnoses | Diagnosis code entries (all rows, not just three) | Matched against RCTC value set OIDs |
| Problems | Problem code entries, including concern status | Status (active/completed) may be part of the rule criterion |
| Lab tests | Lab test LOINC codes | Matched against RCTC lab test value set OIDs |
| Lab results | Coded result values (SNOMED organism/substance codes) | Matched against RCTC result value set OIDs separately from test codes |
| Medications | RxNorm medication codes | Some conditions include medication criteria (e.g., prophylactic treatment) |
| Demographics / age | Patient date of birth | Age-based criteria (e.g., pediatric conditions) |

For example, a condition rule might require a matching lab test code **and** a matching coded result value — both must be present for a full trigger. Another rule might require a diagnosis code **or** a problem code in a given value set. The engine evaluates all combinations automatically.

A condition shows as a **partial match** in the panel when at least one clinical group (diagnosis, problem, or lab) passes but not all required groups pass. This gives you actionable feedback about what data is still needed.

**How codes map to rules**

The engine does not match against raw codes directly. Instead, each code you enter is looked up in a bundled RCTC code-to-OID table (generated from the RCTC release dated 2025-03-18), which maps the code to one or more value set OIDs. The rules themselves reference those OIDs. If a code is not in the lookup table, the engine will not match it regardless of clinical validity.

### The RR generator

The RR XML document produced by [js/rr-generator.js](js/rr-generator.js) is generated separately from the rules engine. It uses a simpler, document-focused approach: it reads the first three diagnosis entries (those with both a code and a name populated) and marks all of them as R1 (Reportable). It does not apply the multi-dimensional rule evaluation that the live engine uses.

> **Practically:** the in-app reportability badge reflects a more nuanced, rules-based evaluation; the downloaded RR XML reflects a simplified classification. Both are appropriate for testing purposes — they represent two different views of the same data.

### Relationship to AIMS and the live eRSD

The rules embedded in the engine are based on the RCTC release (2025-03-18) and approximate the criteria used by the AIMS (APHL Informatics Messaging Services) platform. However, they are **not an exact match** to the live AIMS/eRSD production configuration:

- The OIDs and value set bindings in the bundled engine may differ from those in the current production eRSD. Value set contents evolve with each RCTC release, and the bundled data represents a specific snapshot.
- The bundled engine intentionally ignores rules that contain only demographic criteria (as a safeguard against false positives driven purely by age), which may differ from AIMS behavior.
- The RR XML itself includes a processing warning noting that the eICR was received with an outdated RCTC version (`2.0.1` vs. expected `2025-02-28`, `2.0.0`, or `3.0.1`). This is hardcoded as representative test output and does not reflect actual RCTC version validation.

**What this means for testing:** Use eCeleRate's reportability feedback to guide document construction and explore which clinical data combinations trigger which conditions. Do not treat the in-app determination or the downloaded RR as a ground-truth substitute for validation against a live AIMS instance or the current production eRSD.

### What to pay attention to when filling out the form

| Field | Effect on reportability determination |
|-------|--------------------------------------|
| Diagnosis codes (all rows) | Evaluated against RCTC diagnosis value sets; RCTC TRIGGER badge appears on match |
| Problem codes + concern status | Evaluated against RCTC problem value sets; status may be part of the rule |
| Lab test LOINC codes | Evaluated against RCTC lab test value sets |
| Lab result coded values (SNOMED) | Evaluated against RCTC result value sets independently of the test code |
| Medication RxNorm codes | Evaluated for conditions that include medication-based criteria |
| Patient date of birth / age | Evaluated for conditions with pediatric or age-bounded criteria |
| Diagnosis Code + Name (slots 1–3) | Determines which conditions appear in the downloaded RR XML |
| Patient County | Sets the jurisdiction name in the RR (e.g., "[County] Health Department") |
| Patient State | Included in the jurisdiction address in the RR |
| Document ID, Set ID, Version Number | Referenced in the RR's processing-info section, linking the RR back to the eICR |
| Provider ID, Provider Name, Facility Name | Populates the RR's information recipient |

> **Processing warning note:** The generated RR includes a standard processing warning indicating that the eICR was processed with an outdated eRSD (RCTC) version. This is expected behavior for a testing tool and mirrors what a real AIMS processing response would look like.

---

## 6. RCTC Code Search

Throughout the form, you will find **🔍 search buttons** adjacent to code fields. These trigger the built-in RCTC and SNOMED code lookup, powered by the bundled reportability engine ([js/reportability-engine/bundle.js](js/reportability-engine/bundle.js)).

You can search **by code** or **by display name** across the following value sets:

| Section | Searchable codes |
|---------|-----------------|
| Diagnoses | SNOMED CT, ICD-10-CM (RCTC trigger codes) |
| Problems | SNOMED CT |
| Lab Orders | LOINC (RCTC-searchable) |
| Lab Tests | LOINC (RCTC-searchable) |
| Lab Results | SNOMED CT (organism/result codes) |
| Medications | RxNorm (RCTC-searchable) |
| Procedures | SNOMED CT, LOINC, CPT, ICD-10-PCS (RCTC-searchable) |

Diagnoses that match an RCTC trigger code are automatically labeled with a **RCTC TRIGGER** badge, making it easy to identify which entries would trigger reportability in a real eCR workflow.

---

## 7. Document Versioning

The **Related Document Information** section at the bottom of the form controls whether a generated eICR represents a new document or an update/replacement of a previously submitted document.

### New Document

Select **New Document** as the relationship type. The document will be generated with the Set ID and version number you specify, with no reference to a prior document.

### Replace / Update Document

Select **Replace/Update Document** and enter the **Set ID of the original document** you are replacing in the *Related Document Set ID* field. This Set ID carries forward as the Set ID of the new version. The version number should be incremented from the original (e.g., if the original was version 1, set the new document to version 2).

The eICR will include a `relatedDocument` element referencing the prior document, establishing the update chain required by the eCR specification for amended case reports.

> **Practical tip:** Always record the Set ID of any eICR you submit. You will need it to generate a conformant replacement document if corrections are required.

---

## 8. Tips & Known Considerations

- **Required fields** are marked with a red asterisk (`*`). Document generation will not proceed until all required fields are populated.

- **The patient snapshot card** at the top of the form updates live as you add or remove diagnoses, problems, and lab entries. Use it as a quick completeness check.

- **XSLT rendering** (used for the HTML output in ZIP packages and for in-browser previews) works best in **Chromium-based browsers** (Chrome, Edge). Firefox may have limitations when running from the `file://` protocol locally.

- **File System Access API:** In Chrome and Edge, the save-file dialogs for eICR, RR, and ZIP allow you to choose where to save each file. In other browsers, files go directly to your default Downloads folder.

- **Testing and development use only:** This tool is not validated for production clinical use. Documents generated by eCeleRate are intended for testing, development, training, and HL7 conformance exploration.

- **Sample data:** The form ships pre-populated with data for the fictional patient **Emma Rose Johnson**. Always review all fields and replace sample data with real case data before generating documents for any actual reporting workflow.

- **External dependencies** (JSZip, SheetJS/XLSX) are loaded via CDN. An active internet connection is required when using the hosted version at [https://pat-rickjoyce.github.io/eCR-137/](https://pat-rickjoyce.github.io/eCR-137/). If you are running locally from a clone, these libraries will still be fetched from CDN unless you serve them locally.

---

*Built with ❤️ for the eCR community. Issues and contributions welcome at [https://github.com/Pat-rickJoyce/eCR-137](https://github.com/Pat-rickJoyce/eCR-137).*
