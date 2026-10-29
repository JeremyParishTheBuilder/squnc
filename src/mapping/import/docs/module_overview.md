# Import Module Overview

## Purpose

The Import module transforms discovered data into relational data by executing ordered, SQL-based import instructions.

Import uses the relational query system to select and transform Discovery results, derive relational values, and populate tables in a target database.

Import is responsible for:

- Defining reusable import rulesets and ordered instructions.
- Expressing transformations through the SQL DSL.
- Executing instructions against an existing engine and target database.
- Managing transaction success and failure.
- Reporting instruction-level execution results.

Import does not perform Discovery traversal, schema inference, or inferred database construction. These are separate Mapping operations. Import can populate a newly created target database or apply custom transformations to an existing database, including one constructed from inferred schema.

## High-Level Architecture

```text
DiscoveryResults
       |
       v
Relational Staging Source
       |
       v
Import Ruleset
       |
       v
ImportEngine
       |
       v
SQL Statements
       |
       v
Relational Database
       |
       v
ImportReport
```

The main components are:

- **ImportRuleset** defines an ordered collection of import instructions.
- **ImportInstruction** groups related statements into a named step.
- **InputBatch** provides the SQL DSL used to construct statements.
- **ImportEngine** coordinates ruleset execution and transaction handling.
- **ImportReport** records the outcome of the import attempt.
- **MappingOrchestrator** coordinates Discovery and Import in a single workflow.

## Import Rulesets

An `ImportRuleset` is an immutable definition of an import procedure. It has a required name, an optional description, and an ordered collection of instructions.

Rulesets support creating a definition and deriving updated versions by adding instructions. Instructions can be retrieved by name, and ruleset validation checks required configuration.

A ruleset describes what to execute, not the execution state of a particular import run.

## Import Instructions

An `ImportInstruction` groups one or more SQL statements under a name and optional descriptive metadata.

Instructions execute in their defined order. They provide a logical organization for the import process and for reporting outcomes.

Instructions are not independent transactions. They execute within the transaction managed by `ImportEngine`. If an instruction fails, the engine rolls back the import transaction, and subsequent instructions are marked as not executed.

## SQL DSL and Dialect Support

Import statements are constructed through an `InputBatch` implementation. This provides the SQL DSL for creating tables, inserting rows, selecting data, and composing expressions.

A ruleset factory receives the input batch it uses to construct statements. Its TypeScript type can be specific to a dialect, such as `PostgresInputBatch`.

`ImportEngine` obtains the configured input batch from the supplied `Engine` and passes it to the ruleset factory. The generic type used by the caller is a compile-time contract; it does not independently verify at runtime that the engine's configured dialect matches that type.

Import therefore reuses the relational query and statement infrastructure rather than implementing a separate transformation language.

## Discovery Staging Integration

Import can read Discovery results through the relational staging source supplied during execution.

The staging source exposes each result as a row with these columns:

| Column | SQL type | Nullable |
|---|---|---|
| `resultId` | `SQL_INTEGER` | No |
| `parentResultId` | `SQL_INTEGER` | Yes |
| `nodeType` | `SQL_VARCHAR` | No |
| `identity` | `SQL_JSON` | No |
| `value` | `SQL_JSON` | Yes |
| `metadata` | `SQL_JSON` | No |
| `captures` | `SQL_JSON` | No |

Import can filter by `nodeType`, select and transform structured values using the shared expression system, and use result IDs to relate discovered records where the query facilities support the required relationships.

Structured values are accessed through expressions such as `JSON_VALUE` and `JSON_QUERY`, rather than through an Import-specific JSON transformation language.

Discovery result identity, physical Discovery identity, and any logical identity used for relational rows are distinct concepts. Import defines the target tables and determines how discovered data contributes to them.

The staging interface does not imply that general-purpose ancestor or descendant navigation is available unless the relevant query expressions and execution paths implement it.

## Import Execution

`ImportEngine.import()` accepts an import specification containing:

- The `Engine`.
- The target business database name.
- The discovery staging database name.
- A ruleset factory typed to the intended input batch.

`MappingOrchestrator.import()` retains the latest `DiscoveryResults`, builds the discovery staging database when necessary, ensures the target business database exists, and invokes `ImportEngine` with the appropriate database names.

`ImportEngine` executes the ruleset against the configured engine and target database. Discovery data is accessed through the relational staging source rather than by passing the `DiscoveryResults` collection directly to each SQL statement.

The remaining execution sequence, transaction handling, rollback behavior, and report semantics are unchanged.

The engine coordinates execution in the following order:

1. Obtain the configured input batch and construct the ruleset.
2. Validate the ruleset's execution constraints, including rejecting transaction-control and database-selection statements inside the import instructions.
3. Select the target database and begin a transaction.
4. Execute instructions and their statements in order.
5. Commit if execution succeeds; otherwise, roll back on a statement failure.
6. Return an `ImportReport` describing the outcome.

When Discovery results are supplied, the engine makes them available to statements through the configured staging source.

Ruleset construction and failures during initialization or pre-execution checks may throw rather than produce an `ImportReport`. The report describes an execution attempt that reaches the reporting path.

The target database must be usable by the engine when execution begins. Database creation and database selection are distinct operations; rulesets should not assume that creating a database inside an instruction makes it available for a transaction already initialized against that database.

## Import Reports

An `ImportReport` summarizes the outcome of an import attempt. It exposes overall success and commit status, along with instruction-level results.

Instruction results record the instruction and its status. Depending on the outcome, they can include an error and the index of the failing statement.

The principal instruction statuses are:

- `succeeded`: the instruction completed successfully.
- `failed`: execution of the instruction failed.
- `notExecuted`: the instruction was not run because an earlier instruction failed.

On a statement failure, the transaction is rolled back and remaining instructions are marked as not executed. The report distinguishes successful completion from a failed import, even if earlier instructions had executed before the rollback.

Initialization errors that throw before a report is produced are not represented by these instruction statuses.

## Relationship to Discovery and Validation

Discovery locates external data and exposes its results through the staging interface. Import transforms those results into relational data using SQL statements and a target schema.

Validation evaluates rules against relational data and reports constraint or business-rule violations. It is a separate concern from Import's execution reporting.
`MappingOrchestrator` coordinates Discovery, staging database creation, inferred business database construction, and custom Import.

The orchestrator retains the latest `DiscoveryResults` and `ImportReport`. Its `buildBusinessDatabase()` operation explicitly infers a schema and constructs a populated business database from selected discovery results. Its separate `import()` operation ensures the target database exists and executes a custom Import ruleset.

`import()` does not automatically invoke `buildBusinessDatabase()`. Callers choose which operations to run and in what order.

Validation remains independent of Import execution and evaluates business rules against relational data.

## Design Principles

- Define transformations declaratively through the shared SQL DSL.
- Keep ruleset definitions immutable and instruction order explicit.
- Centralize transaction management in `ImportEngine`.
- Roll back failed imports rather than leave partial changes committed.
- Separate execution reports from validation reports.
- Use the relational staging interface as the boundary between Discovery and Import.
- Keep automatic schema inference and database construction as separate responsibilities.