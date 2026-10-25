# SQUNC - Relational Query Engine for Data Pipelining

**Squnc** is an in-memory relational query engine designed for data pipelining—importing, staging, validating, querying, and exporting structured datasets within CI/CD and ETL workflows. Built around a fluent builder that mirrors SQL query syntax, Squnc ingests raw JSON/CSV inputs into a relational model where schema rules, transformations, and assertions are executed declaratively. Originally developed to process and validate complex registries (such as the Cosmos Chain Registry), its zero-runtime-dependency architecture provides a lightweight, deterministic framework for any structured data source.

<img width="300" height="300" alt="squnc-logo" src="https://github.com/user-attachments/assets/00e3b117-5717-4b63-a726-35daf5f3bf46" />

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
