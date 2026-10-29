# Architecture

## Overall Flow

The system supports two distinct paths from discovered data into a relational database:

```text
External Source
      |
      v
  Discovery
      |
      v
DiscoveryResults
      |
      +---------------------------+
      |                           |
      v                           v
Discovery Staging            Schema Inference
      |                           |
      v                           v
 Custom Import             Inferred Schema
      |                           |
      v                           v
Relational Database <--- Database Builder
      |
      v
Queries / Mutations
      |
      v
Validation
      |
      v
Export
```

The diagram represents available operations, not a mandatory sequence. Custom Import and inferred database construction are separate workflows. A caller may construct a business database directly from discovery results or use custom Import rulesets to populate or transform a target database.

The system is divided into three major layers:

- **Mapping** — discovers external data and provides mechanisms for constructing and populating relational databases.
- **Engine / Relational** — owns relational state, execution, and structural correctness.
- **Validation** — evaluates business rules independently of committed relational state.

## Mapping

The Mapping layer transforms external structured data into relational representations.

Its responsibilities are:

- **Discovery** — locate and describe external data.
- **Schema Inference** — infer relational tables and columns from discovered payloads.
- **Database Construction** — construct and populate relational databases from inferred schemas and discovery results.
- **Import** — execute custom SQL-based rulesets against discovery staging data and target databases.
- **Orchestration** — coordinate operations and retain their latest results.

### Discovery

Discovery traverses hierarchical data and produces `DiscoveryResults`, a collection of `DiscoveryResult` records.

Discovery is composed of `DiscoveryRoot`, `DiscoverySource`, `DiscoveryNode`, navigators, and optional decoders. This separates the origin of data from the rules used to navigate, match, decode, and capture values.

Each result records its local result identifier, parent result identifier, node type, physical identity, payload, metadata, and captures. Parent-child relationships use result identifiers rather than nested child collections.

Discovery is independent of relational schema and business validation.

### Schema Inference and Database Construction

`SchemaBuilder` observes selected discovery payloads and infers relational tables, columns, SQL types, and nullability. Nested objects are flattened into columns, while arrays are represented as child tables.

`DatabaseBuilder` combines the inferred schema with discovery results to construct and populate a relational database. It adds structural identity and parent-reference columns where required and validates construction prerequisites.

`MappingOrchestrator.buildBusinessDatabase()` coordinates inference and construction for a selected discovery node type. The completed database is installed into the Engine only after construction succeeds.

This is an explicit operation. `MappingOrchestrator.import()` does not automatically invoke schema inference or database construction.

### Custom Import

Import provides a separate mechanism for transforming discovery data into relational rows.

`ImportRuleset` contains ordered `ImportInstruction` objects, each grouping SQL statements. `ImportEngine` makes discovery results available through a relational staging source, selects the target database, executes instructions in order, and manages the import transaction.

The staging source exposes discovery result fields, including identifiers, node types, identities, payloads, metadata, and captures. SQL expressions can extract structured or scalar values where supported.

Import can create and populate tables or apply custom transformations to an existing database. The target database must exist before the import transaction begins; the orchestrator ensures its existence.

Successful imports commit. A statement failure causes rollback, and an `ImportReport` records execution outcomes when reportable execution occurs.

### Mapping Orchestration

`MappingOrchestrator` coordinates Discovery, staging database creation, inferred database construction, and custom Import.

Its principal operations are:

- `discovery()` — execute discovery and retain the resulting records.
- `buildDiscoveryDatabase()` — expose discovery results through a relational staging database.
- `buildBusinessDatabase()` — infer a schema and construct a populated business database.
- `import()` — execute a custom Import ruleset against a target database.

Discovery must run before operations that depend on its results. A new Discovery run invalidates the previous Import report. Building a new business database also invalidates the previous report.

Orchestration coordinates these operations but delegates schema inference, database construction, SQL execution, and transaction management to their respective components.

## Engine and Relational

The Engine owns committed relational state and executes SQL.

The Relational module provides the immutable relational representation and structural correctness mechanisms used by the Engine.

Primary runtime components include:

- `Engine`
- `Transaction`
- `ExecutionContext`
- `Databases`
- `Database`
- `Table`

Semantic analysis resolves schema references and compiles expressions, predicates, mutations, and queries before execution. It also resolves engine and dialect policy used by schema-modification actions.

Mutations produce immutable `Action` objects that transform relational state.

Queries produce immutable `QueryPlan` objects containing an executable plan root and `QueryColumn` metadata. Execution evaluates the plan against relational snapshots and produces `QueryResult` objects containing query metadata and resulting `RowView` objects.

Relational constraints enforce structural integrity during execution.

### DDL and Query-Based Table Creation

DDL statements are analyzed semantically and converted into executable actions. `CREATE TABLE` can define columns and constraints explicitly. Supported dialects can also create and populate a table from a `SELECT` query using CTAS.

For CTAS, semantic analysis binds the query into a `QueryPlan`, derives destination column metadata from its `QueryColumn[]`, and combines that metadata with explicit column definitions according to dialect rules.

Query output metadata does not implicitly inherit source defaults, auto-increment behavior, or constraints.

Dialect rules determine which CTAS forms are permitted, including whether explicit column lists must match the query column count and whether constraints are allowed.

### Query Plans

SELECT and other query statements are semantically bound into immutable `QueryPlan` objects.

A query plan contains:

- A plan root responsible for producing result rows.
- `QueryColumn` metadata describing the query output.

`QueryColumn` metadata contains the result name, SQL type, and nullability. Metadata is derived from resolved expressions rather than being limited to physical source-table columns.

Queries can be composed. For example, `UNION ALL` binds its child queries independently, reconciles output metadata positionally, and produces a combined query plan. Result names come from the left query, compatible types are reconciled through common SQL type rules, and nullability is combined.

Query-plan metadata forms the schema contract for consumers such as `INSERT ... SELECT`, CTAS, and query results. Query execution preserves this metadata in `QueryResult` alongside evaluated `RowView` objects.

### INSERT ... SELECT

`INSERT ... SELECT` combines query planning and relational mutation.

Semantic analysis binds the source query into a `QueryPlan`, including its output metadata. An `InsertSelectAction` evaluates the plan and inserts the resulting rows through the relational insertion path.

## DSL

The DSL provides fluent builders for:

- Discovery definitions.
- SQL statements.
- Expressions and predicates.
- Other supported runtime and query-building operations.

Runtime builders evaluate against typed contexts, while SQL builders construct ASTs for semantic analysis.

Expression nodes provide reusable fluent operations for composing expressions and predicates. Arithmetic operations produce expressions, while comparisons produce predicates. These operations are available across applicable expression nodes rather than being limited to column references.

SQL query builders support composition through nested query expressions. Nested queries use independent input batches, allowing a query to serve as the source of another query or mutation without overwriting the outer statement's builder state.

`UNION ALL` is exposed as a fluent query operation, and `INSERT ... SELECT` accepts a query as its source.

## Validation

Validation is separate from relational storage and structural integrity.

The Relational layer enforces constraints required for relational correctness. The Validation layer defines additional business rules and evaluates them against an existing relational database.

Validation rules reuse constraint statements and the existing SQL and semantic infrastructure. They execute within transactions and roll back after evaluation, producing structured `ValidationReport` objects without changing committed state.

## Core Invariants

- Tables and databases are immutable.
- Actions, query plans, expressions, and predicates operate without mutating committed state.
- Query execution does not mutate relational state.
- Schema references are resolved before execution.
- Referential propagation operates against immutable relational state.
- Structural validation belongs to the Relational / Engine layer.
- Business validation belongs to the Validation layer.
- Discovery is independent of Import and relational schema.
- Discovery results use explicit result identifiers and parent relationships.
- Schema inference and database construction can operate directly on discovery results.
- Custom Import is separate from inferred database construction.
- Query-plan metadata describes query output independently of physical source tables.
- Database construction and transactional Import are separate operations.

## Architectural Boundary

```text
External Data
      |
      v
    Mapping
      |
      v
Relational Database
      |
      v
 Engine / Relational
      |
      v
  Validation
      |
      v
    Export
```

The Mapping layer is responsible for **representing external data and constructing or populating relational databases**.

The Engine and Relational layers are responsible for **relational state, execution, and structural correctness**.

The Validation layer is responsible for **business correctness**.