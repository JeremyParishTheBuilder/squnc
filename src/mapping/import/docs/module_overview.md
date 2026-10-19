# Import Module Overview

## Purpose

The Import module transforms discovered data into relational data.

It is responsible for:

- selecting and transforming Discovery results
- deriving relational values through SQL expressions
- associating related results using discovery relationships
- defining and executing ordered import instructions
- managing import transactions and reporting execution outcomes

Import does not locate external data or define business validation rules. Discovery identifies and describes data; Import determines its relational representation.

---

## High-Level Architecture

```text
DiscoveryResults
      |
      v
Relational Staging Source
      |
      v
ImportRuleset
      |
      v
ImportInstruction[]
      |
      v
ImportEngine
      |
      v
Relational Database
      |
      v
ImportReport
```

An import ruleset describes the transformation as ordered instructions containing SQL statements. The ImportEngine executes those statements within a transaction and returns a report.

---

## Import Rulesets

`ImportRuleset` groups ordered `ImportInstruction` objects into a named import operation.

Rulesets are immutable. `withInstruction()` returns a new ruleset containing the additional instruction.

A ruleset provides:

- a name and optional description
- an ordered collection of instructions
- lookup by instruction name

Rulesets describe the transformation declaratively rather than implementing it as a custom traversal of Discovery results.

---

## Import Instructions

An `ImportInstruction` groups SQL statements into a named unit of import work.

Each instruction contains:

- a required name
- an optional description and category
- one or more statements

Instructions execute in declaration order, and statements within each instruction execute in order.

An instruction represents a reporting and organizational boundary, not an independent transaction. The ImportEngine owns transaction control.

---

## SQL DSL and Dialect Independence

Ruleset factories receive an `InputBatch` and use its SQL DSL to construct statements.

This separates the description of an import transformation from its execution. The ImportEngine uses the engine's configured input batch rather than directly depending on a particular SQL dialect.

The ruleset factory is evaluated before transaction execution begins. Consequently, errors encountered while constructing a ruleset are distinct from statement-execution failures and do not produce an `ImportReport`.

---

## Discovery Staging Integration

Import accesses discovered data through the relational staging source exposed by `discovery()`.

The staging source presents each `DiscoveryResult` as a row with these columns:

| Column | SQL type | Nullable |
|---|---|---|
| `resultId` | `SQL_INTEGER` | No |
| `parentResultId` | `SQL_INTEGER` | Yes |
| `nodeType` | `SQL_VARCHAR` | No |
| `identity` | `SQL_JSON` | No |
| `value` | `SQL_JSON` | Yes |
| `captures` | `SQL_JSON` | No |

The source adapts discovery values, identities, and captures into structured values accessible through the query expression system.

Import can filter results by `nodeType`, extract fields from structured values, and associate related results through `resultId` and `parentResultId`. These relationships do not depend on physical Discovery identities or nested child objects.

A ruleset can use an explicitly supplied `DiscoveryResults` collection or the discovery source supplied through statement execution options by the ImportEngine.

Discovery captures remain available as metadata, but values derived for relational output generally belong in Import expressions.

---

## Import Execution

`ImportEngine.import()` receives an engine, target database name, optional Discovery results, and a ruleset factory.

Execution proceeds as follows:

1. Construct the ruleset using the engine's input batch.
2. Reject instructions containing transaction-control or database-selection statements managed by the ImportEngine.
3. Select the target database.
4. Begin a transaction.
5. Execute instructions and their statements in order.
6. Commit if all statements succeed; otherwise, roll back and return a failed report.

Database creation is explicit. The caller must create the target database beforehand or include a database-creation instruction in the ruleset.

The ImportEngine passes the optional Discovery results to statement execution as the `discovery` source. If a statement requires Discovery results but none were supplied, the resulting execution error is reported as a failed instruction.

---

## Import Reports

`ImportReport` summarizes the outcome of an import operation.

Each `ImportInstructionResult` records the instruction, its status, and, when applicable, the error and zero-based index of the failed statement.

Instruction statuses are:

- `succeeded` — all statements in the instruction completed.
- `failed` — a statement failed during execution.
- `notExecuted` — the instruction was skipped after an earlier failure.

After a statement failure, subsequent instructions are marked `notExecuted`, and the transaction is rolled back.

The report exposes:

- `committed` — whether the transaction committed
- `passed` — whether the transaction committed and every instruction succeeded
- `failed` — the inverse of `passed`
- `failedInstructions` and `failedInstructionCount` — instructions that failed during execution

The report covers execution outcomes, not every possible error. Failures during ruleset construction, pre-execution checks, database selection, or transaction initialization may throw before a report is returned.

---

## Relationship to Discovery and Validation

Discovery answers:

> Where is the data, and what was discovered?

Import answers:

> How should discovered data become relational data?

Validation answers:

> Does the resulting relational data satisfy the required rules?

These responsibilities remain separate. Import constructs relational data; Validation evaluates that data against defined constraints and rules.

---

## Design Principles

- Import transforms discovered data through declarative SQL statements.
- Rulesets and instructions define deterministic execution order.
- Discovery results are consumed through a relational staging interface.
- Result IDs establish Discovery relationships; physical and relational identities remain distinct.
- The ImportEngine owns transaction management and execution reporting.
- Database creation is explicit rather than an implicit side effect.
- Import transformation and business validation remain separate concerns.