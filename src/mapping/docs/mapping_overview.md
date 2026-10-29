# Mapping Overview

## Purpose

The Mapping module transforms external structured data into relational data through Discovery, schema inference, database construction, and custom Import.

Its current responsibilities are:

1. **Discovery** — locate and describe data from external sources.
2. **Schema Inference** — infer relational tables and columns from discovered payloads.
3. **Database Construction** — construct and populate a relational database using inferred schema and discovery results.
4. **Import** — execute SQL-based rulesets to transform discovery data into relational data.
5. **Orchestration** — coordinate these operations and retain their latest results.

Mapping does not enforce business rules or perform validation. Those responsibilities belong to downstream components.

## High-Level Architecture

The broader ETL pipeline supports the following operations:

```text
External Source
      |
      v
DiscoveryRoot
      |
      v
DiscoveryResults
      |
      +--------------------------+
      |                          |
      v                          v
Discovery Staging Source    Schema Inference
      |                          |
      v                          v
ImportRuleset              Inferred Schema
      |                          |
      v                          v
ImportEngine               Database Construction
      |                          |
      v                          v
Relational Database        Populated Business Database
```

The two paths serve different purposes:

- **Inferred construction** derives a schema from discovered payloads and populates a database directly.
- **Custom Import** executes caller-defined SQL rulesets against discovery staging data to populate or transform a target database.

These operations are distinct. `MappingOrchestrator.import()` does not automatically infer a schema or invoke database construction.

## Discovery

Discovery locates and describes data without imposing a relational schema.

A `DiscoveryRoot` combines a `DiscoverySource` with a root `DiscoveryNode`. The source determines where discovery begins; the discovery graph determines how values are navigated, matched, decoded, and described.

Discovery nodes can define:

- Navigation through source structures.
- Matching rules.
- Optional decoding.
- Captured values.
- Metadata associated with discovered objects.

Executing `DiscoveryRoot.discover()` produces `DiscoveryResults`, a collection of `DiscoveryResult` records.

Each result contains:

- `resultId` — an identifier within the result collection.
- `parentResultId` — the parent result identifier, or `null` for a root result.
- `nodeType` — the logical type assigned by the discovery graph.
- `identity` — the physical identity of the discovered object.
- `value` — the discovered payload.
- `metadata` — descriptive information about the result.
- `captures` — values explicitly captured during discovery.

Results are related through `resultId` and `parentResultId`, not nested child arrays. Result identifiers and physical identities serve different purposes.

Discovery describes discovered data and exposes its structure to downstream operations. It does not determine the final relational schema.

### Discovery Sources

`DiscoverySource` abstracts the origin of discovered data. Discovery depends on this abstraction rather than a particular storage medium.

Sources can represent filesystem objects, structured documents, or other supported external data. Available source implementations determine which origins can be used.

A source provides the root value from which discovery proceeds.

### Discovery Staging Interface

`DiscoveryResults` can be exposed as a relational staging source named `discovery`.

The staging representation makes discovery records available to SQL queries. Consumers can filter by `nodeType`, inspect `value`, `metadata`, and `captures`, and relate records through their result identifiers.

The staging contract includes:

- `resultId`
- `parentResultId`
- `nodeType`
- `identity`
- `value`
- `metadata`
- `captures`

Structured fields are represented as JSON values. SQL expressions can extract scalar or structured values where supported by the expression implementation.

The staging interface allows Import to consume discovery data without depending directly on the discovery graph's navigation implementation.

## Schema Inference

`SchemaBuilder` infers a relational schema by observing structured payloads in `DiscoveryResults`.

Inference can be restricted to a particular `nodeType`, allowing the caller to select which discovered records define the schema.

The current inference behavior includes:

- Mapping object properties to relational columns.
- Flattening nested objects into columns with path-based names.
- Representing arrays as child tables.
- Flattening object elements into columns in child tables.
- Representing scalar array elements through a `value` column.
- Tracking nullable columns when properties are absent or null.
- Creating child-table definitions even when observed arrays are empty.

Incompatible scalar types cause inference to fail. A column whose observations are exclusively null cannot have its type inferred and also causes failure.

Schema inference describes the relational structure implied by observed payloads. It does not enforce business rules or guarantee that the inferred schema represents every possible source value.

## Database Construction

`DatabaseBuilder` constructs and populates a relational database from an inferred schema and the corresponding discovery results.

Construction includes:

- Creating inferred tables and columns.
- Adding structural identity columns.
- Recording parent-node information for child tables.
- Populating rows from discovered payloads.
- Preserving discovery identities as structured values rather than serialized identity strings.

The builder rejects an existing target database and validates structural requirements before completing construction. The database is installed into the engine only after the build succeeds, so a failed build does not partially install the new database.

The current implementation rejects nested arrays when they would need to be represented as scalar values.

### Building a Business Database

`MappingOrchestrator.buildBusinessDatabase(engine, databaseName, nodeType)` provides the explicit operation for schema inference and database construction.

Discovery must run first. The method infers a schema from results matching the requested `nodeType`, builds and populates the database, and installs the completed database into the engine.

The default `nodeType` is `chainFile`.

This operation is separate from custom Import. Callers decide when to build an inferred database and which discovered node type should define it.

## Import

Import transforms discovery data into relational tables using SQL statements.

Import is defined by an `ImportRuleset`, which contains an ordered sequence of `ImportInstruction` objects. Each instruction groups statements under a name and optional description.

The ruleset factory receives the configured `InputBatch`, allowing statements to be constructed using the appropriate SQL API.

An import can create tables, select and transform discovery data, and insert resulting rows. Import rulesets can also perform custom transformations against an existing inferred business database.

Import does not perform Discovery or schema inference itself. It consumes discovery data made available through the relational staging interface.

### Import Rulesets

`ImportRuleset` defines the work to execute. Instructions and their statements execute in declared order.

Rulesets contain import operations, not database lifecycle management. The target database must exist before import begins; creating it is not an instruction within the import transaction.

Custom Import rulesets may query and transform the inferred business database, provided it has been constructed before Import executes and the Import operation targets that database.

### Import Engine

`ImportEngine` executes a ruleset against a specified database using the supplied `Engine` and `InputBatch` type.

Its responsibilities include:

- Making supplied discovery results available to SQL queries.
- Selecting the target database.
- Executing instructions and statements in order.
- Committing successful imports.
- Rolling back changes when a statement fails.
- Producing an `ImportReport` describing execution outcomes.

Transaction-control and database-selection operations are not permitted inside import instructions because the engine manages the import transaction and target database selection.

An `ImportReport` records the execution outcome. Failures during setup or before reportable statement execution may propagate as exceptions rather than produce a report.

## Mapping Orchestration

`MappingOrchestrator` coordinates Discovery, inferred database construction, and custom Import without combining their responsibilities.

Its operations include:

- `discovery(root)` — execute a `DiscoveryRoot` and retain the resulting `DiscoveryResults`.
- `buildDiscoveryDatabase(engine, databaseName)` — expose discovery results as a relational staging database.
- `buildBusinessDatabase(engine, databaseName, nodeType)` — infer a schema and construct a populated business database.
- `import(spec)` — ensure the target database exists, then execute a custom Import ruleset.

Discovery must run before the other operations that depend on its results.

`import()` ensures that the target database exists through `Engine.ensureDatabase()`. An existing database is preserved; a missing database is created before import execution. The method does not automatically call `buildBusinessDatabase()`.

The orchestrator retains the latest discovery results and import report. A new Discovery run invalidates the previous import report. Building a new business database also invalidates the previous report.

The orchestrator coordinates operations but does not implement SQL execution or transaction management itself.

## Downstream Responsibilities

The broader ETL pipeline continues beyond Mapping:

- **Relational Engine** — manages relational state, queries, mutations, and structural integrity.
- **Validation** — checks business rules and reports violations.
- **Export** — produces external representations of relational data.

Mapping constructs and transforms data but does not replace these responsibilities.

## Design Principles

- Discovery locates and describes data; it does not determine the final relational schema.
- Discovery results are related by result identifiers rather than nested child collections.
- Physical identity and discovery-result identity are distinct.
- Schema inference and database construction can operate directly on discovery results.
- Custom Import remains a separate, explicitly invoked workflow.
- The staging interface separates discovery structure from Import logic.
- SQL expressions provide the transformation mechanism for Import.
- Database construction is separate from transactional Import execution.
- The orchestrator coordinates stages without duplicating their responsibilities.
- Validation and business semantics remain outside Mapping.