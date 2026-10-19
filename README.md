# TS-ETL-OLAP

SQUNC is an embedded, in-memory relational engine for importing, editing, validating, querying, and exporting structured datasets.

Although originally designed for blockchain registries such as the Cosmos Chain Registry, the architecture is intentionally generic and can be adapted to other structured data sources.

Instead of treating JSON files as isolated documents, TS-ETL-OLAP imports them into a relational database where consistency rules, queries, and transformations can be expressed declaratively.

## Overview

The import pipeline follows a simple progression:

```text
Filesystem
    ↓
Discovery
    ↓
Import
    ↓
Relational Database
    ↓
Mutation / Query
    ↓
Validation
    ↓
Export
```

Discovery locates entities within an external data source.

Import maps those entities into relational tables.

The database engine provides immutable querying, mutation, and constraint enforcement.

Validation expresses business-specific rules independently from import.

Finally, the relational data can be exported back into its external representation.

## Features

* Declarative filesystem discovery
* Declarative import mapping
* Automatic schema inference
* Automatic flattening of nested object structures
* Automatic inference of nested array mappings
* Immutable relational database engine
* SQL-like mutation and query model
* Primary key, unique, foreign key, and check constraint enforcement
* Deferred business validation
* Deterministic execution
* Pluggable import formats

## Design Goals

The project is built around several core principles:

* Keep discovery independent from import.
* Keep import independent from validation.
* Represent external data relationally.
* Prefer immutable data structures.
* Infer common behavior automatically while allowing explicit overrides.
* Separate relational correctness from business correctness.

## Documentation

* **System Overview** — overall architecture and execution model
* **Architecture** — subsystem responsibilities and boundaries
* **Mapping Overview** — import pipeline and mapping layer
* **Subsystem documentation** — implementation details for individual components

## Project Status

The project is under active development. The architecture is evolving toward a generic relational ETL and validation framework capable of supporting multiple structured data formats beyond JSON.

## Example

```ts
const result = ImportPipeline.build({
    importRoots: importRoots,
    databaseName: "Test Registry",
    existingDatabases: engine.databases,
    sourceIdentity: "Test Registry",
  });

engine.install(result.databases);

const rows = engine
    .database("Registry")
    .table("Chains")
    .rows();
```
