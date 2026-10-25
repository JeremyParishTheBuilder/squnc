# Mapping Overview

## Purpose

The Mapping module coordinates the transformation of external structured data into relational data.

Its current responsibilities are:

1. **Discovery** — locate and describe data from external sources.
2. **Import** — query discovery results and populate a relational database using SQL-based rulesets.
3. **Orchestration** — coordinate Discovery and Import, retaining their latest results.

Schema inference and database construction are planned downstream stages, not responsibilities of the current Mapping implementation.

Mapping does not enforce business rules or perform validation. Those responsibilities belong to downstream components.

---

## High-Level Architecture

```text
External Source
      |
      v
DiscoveryRoot
      |
      v
DiscoveryResults
      |
      v
Relational Staging Source
      |
      v
ImportRuleset
      |
      v
ImportEngine
      |
      v
Relational Database
```

`MappingOrchestrator` coordinates Discovery and Import. It ensures the target database exists before invoking Import.

Discovery and Import have distinct responsibilities and communicate through the discovery staging interface.

---

## Discovery

Discovery locates and describes data without imposing relational schema.

A `DiscoveryRoot` combines a `DiscoverySource` with a root `DiscoveryNode`. The source determines where discovery begins; the discovery graph determines how values are navigated, matched, decoded, and described.

Discovery nodes can define:

- Navigation through source structures.
- Matching rules.
- Optional decoding.
- Captured values.
- Metadata associated with discovered objects.

Executing `DiscoveryRoot.discover()` produces `DiscoveryResults`, a collection of `DiscoveryResult` records.

Each `DiscoveryResult` contains:

- `resultId` — an identifier for the result within its collection.
- `parentResultId` — the identifier of its parent result, or `null` for a root result.
- `nodeType` — the logical type assigned by the discovery graph.
- `identity` — the physical identity of the discovered object.
- `value` — the discovered value.
- `metadata` — descriptive information about the result.
- `captures` — values explicitly captured during discovery.

Results are related through `resultId` and `parentResultId`, not nested child arrays. Result identifiers and physical identities serve different purposes.

Discovery describes physical structure without determining the final relational schema.

## Discovery Sources

`DiscoverySource` abstracts the origin of discovered data. Discovery depends on this abstraction rather than a particular storage medium.

Sources can represent filesystem objects, structured documents, or other supported external data. The available source implementations determine which origins can actually be used.

A source provides the root value from which discovery proceeds.

## Discovery Staging Interface

`DiscoveryResults` can be exposed as a relational staging source named `discovery`.

The staging representation makes discovery records available to SQL queries. Consumers can filter by `nodeType`, extract values from `value` or `metadata`, inspect captures, and relate records through their result identifiers.

The staging contract includes:

- `resultId`
- `parentResultId`
- `nodeType`
- `identity`
- `value`
- `metadata`
- `captures`

Structured fields are represented as JSON values. SQL expressions such as `JSON_VALUE` and `JSON_QUERY` can extract scalar and structured data, respectively, where supported by the expression implementation.

Discovery defines what was found and exposes its results. Import determines how those results become relational rows.

---

## Import

Import transforms discovery data into relational tables using SQL statements.

Import is defined by an `ImportRuleset`, which contains an ordered sequence of `ImportInstruction` objects. Each instruction groups statements under a name and optional description.

The ruleset factory receives the configured `InputBatch`, allowing statements to be constructed using the appropriate SQL API.

An import can create tables, select and transform discovery data, and insert the resulting rows. For example, a query can select results of a particular `nodeType` and extract a directory name from result metadata before inserting it into a target table.

Import does not perform Discovery itself. It consumes the `DiscoveryResults` supplied by the orchestrator.

### Import Rulesets

`ImportRuleset` defines the work to execute. Instructions and their statements execute in declared order.

Rulesets contain import operations, not database lifecycle management. The target database must exist before import begins; creating it is not an instruction within the import transaction.

### Import Engine

`ImportEngine` executes a ruleset against a specified database using the supplied `Engine` and `InputBatch` type.

Its responsibilities include:

- Making supplied discovery results available to SQL queries.
- Selecting the target database.
- Executing instructions and statements in order.
- Committing successful imports.
- Rolling back the transaction when a statement fails.
- Producing an `ImportReport` describing execution outcomes.

Transaction-control and database-selection operations are not permitted inside import instructions because the engine manages the import transaction and target database selection.

An `ImportReport` records the execution outcome. Failures that occur during setup or before reportable statement execution may propagate as exceptions rather than produce a report.

---

## Mapping Orchestration

`MappingOrchestrator` coordinates the Discovery-to-Import workflow.

Its responsibilities are to:

1. Execute a `DiscoveryRoot` and retain the resulting `DiscoveryResults`.
2. Require successful Discovery before Import.
3. Ensure the requested target database exists.
4. Invoke `ImportEngine` with the retained discovery results.
5. Retain and return the resulting `ImportReport`.

Database existence is handled through `Engine.ensureDatabase()`. An existing database is preserved; a missing database is created before import execution.

The orchestrator receives the engine and database name as part of the import specification. Callers do not need a separate database-setup step.

The orchestrator retains the latest discovery results and import report. A new Discovery run invalidates the previous import report because it belongs to an earlier discovery run.

The orchestrator coordinates the workflow but does not implement SQL execution or transaction management itself.

---

## Downstream Responsibilities

Schema inference and database construction follow Import in the broader ETL pipeline.

Their planned responsibilities are to infer relational tables, columns, types, and relationships from imported data, then construct the resulting database schema and database.

These stages are not currently part of the Mapping orchestration workflow.

Validation and business-rule enforcement remain separate from Mapping.

---

## Design Principles

- Discovery locates and describes data; Import transforms it into relational data.
- Discovery results are related by result identifiers rather than nested child collections.
- Physical identity and discovery-result identity are distinct.
- The staging interface separates discovery structure from import logic.
- SQL expressions provide the transformation mechanism for Import.
- Database creation is separate from transactional import execution.
- The orchestrator coordinates stages without duplicating their responsibilities.
- Discovery does not determine the final relational schema.
- Validation and business semantics remain outside Mapping.
