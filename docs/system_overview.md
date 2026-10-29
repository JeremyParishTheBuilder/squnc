# System Overview

Embedded in-memory ETL and validation engine for hierarchical structured datasets such as filesystem registries, JSON documents, and similar sources.

The system represents external structured data as relational data, supporting both inferred database construction and custom SQL-based imports.

```
External Data
      |
      v
  Discovery
      |
      v
DiscoveryResults
      |
      +------------------------+
      |                        |
      v                        v
Custom Import            Schema Inference
      |                        |
      v                        v
Relational Database <--- Database Construction
      |
      v
Mutation / Query
      |
      v
  Validation
      |
      v
    Export
```

The two Mapping paths are distinct operations, not a mandatory linear sequence. Inferred database construction builds a populated database directly from discovery results. Custom Import executes caller-defined rulesets against discovery staging data and a target database.

## Capabilities

- Declarative hierarchical discovery across supported data sources
- Typed discovery results with parent relationships, captures, metadata, and physical identities
- Relational staging of discovery results for SQL-based processing
- Automatic relational schema inference from structured payloads
- Automatic representation of nested objects and arrays through columns and child tables
- Database construction and population from inferred schemas and discovery results
- Ordered SQL-based Import rulesets with transactional execution and reports
- SQL expressions for computed values and data transformations
- Immutable relational database representation
- SQL-like DDL, DML, and query support
- Deterministic query execution through compiled query plans
- Immediate relational constraint enforcement (PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK)
- Referential actions (RESTRICT, CASCADE, SET NULL, NO ACTION)
- Deferred business validation independent of committed state
- Reusable fluent expression and predicate DSL
- Immutable transactional execution

## Design Principles

- Immutable persistent data structures
- Deterministic execution
- Discovery is independent of relational schema and Import.
- Schema inference and database construction can operate directly on discovery results.
- Custom Import is separate from inferred database construction.
- Import is independent of business validation.
- Expressions and predicates are reusable across applicable contexts.
- Physical discovery identities and result identifiers are distinct.
- Explicit configuration can override inferred behavior where supported.
- Separation of discovery, schema inference, database construction, Import, execution, validation, and export
- Stable runtime identifiers with case-insensitive user-facing names
- Pure execution over immutable database state
- Discovery is independent of the underlying storage medium.
- Navigation and decoding are separate concerns.

## Execution Model

- Discovery traverses hierarchical data through navigators and optional decoders, producing `DiscoveryResults`.
- Discovery results retain payloads, metadata, captures, physical identities, and parent relationships.
- Schema inference observes selected discovery payloads to derive relational tables, columns, types, and nullability.
- Database construction combines an inferred schema with discovery results to build and populate relational objects.
- Custom Import exposes discovery results through a relational staging source and executes ordered SQL-based rulesets against a target database.
- `MappingOrchestrator` coordinates Discovery, staging database creation, inferred database construction, and custom Import. Inferred construction is explicit; `import()` does not automatically invoke it.
- The Engine manages relational state and transactions.
- Semantic analysis resolves schema references and compiles executable mutations and queries.
- Mutations execute as immutable state transformations.
- Queries execute as compiled query plans over relational snapshots.
- Validation evaluates business rules against relational databases without modifying committed state.

## Interface Layer

- Fluent builder APIs for discovery, SQL statements, expressions, and predicates
- Compile-time and runtime enforcement of valid builder sequences where supported
- Structured AST representation for SQL
- Typed expression and predicate composition
- SQL operations include DDL, DML, queries, and query-based table creation where supported by the active dialect
- Query composition through supported operations such as `UNION ALL` and `INSERT ... SELECT`

## Typical Use Cases

- Registry import and validation
- Configuration management
- Metadata repositories
- Structured filesystem datasets
- ETL pipelines requiring deterministic relational processing
- Safe editing and validation prior to export