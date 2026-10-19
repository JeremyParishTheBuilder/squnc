# Discovery Module Overview

## Purpose

The Discovery module locates and describes structured data within external sources.

It is responsible for:

- navigating hierarchical data
- matching values and structures
- decoding values when required
- capturing discovery metadata
- establishing physical discovery identities
- producing a collection of related `DiscoveryResult` records

Discovery does not define relational tables, business rules, or relational constraints. Its results are consumed by Import.

---

## High-Level Architecture

```text
External Source
      |
      v
DiscoverySource
      |
      v
DiscoveryRoot
      |
      v
DiscoveryNode Graph
      |
      v
DiscoveryResults
      |
      v
Import
```

A source provides the initial value. A root combines the source with a discovery node. The discovery graph navigates, matches, decodes, and captures values, producing results linked by result IDs.

---

## Discovery Sources

`DiscoverySource` abstracts the origin of discovered data.

Sources may represent filesystem objects, JSON documents, archives, HTTP resources, databases, or in-memory structures.

A source provides the initial value from which discovery begins. It does not determine how that value is traversed.

Discovery depends on the source abstraction rather than a particular physical storage medium.

---

## Discovery Roots

`DiscoveryRoot` defines an independent discovery operation by combining a `DiscoverySource` with a root `DiscoveryNode`.

A root initializes the discovery process and collects its results in a `DiscoveryResults` instance.

Multiple roots may operate on different sources or provide different views of the same external data.

Discovery operates independently of Import and the target relational schema.

---

## Discovery Nodes

A `DiscoveryNode` describes one step in the discovery graph.

A node may define:

- navigation to related values
- matching conditions
- decoding
- captures
- child discoveries

Nodes describe how physical or structured data is located and interpreted for discovery. They do not define relational tables or columns.

Discovery nodes may use expressions to match values and derive captures from the current value or discovery context. These expressions belong to the Discovery execution model, not the relational SQL transformation model used by Import.

---

## Navigation

`DiscoveryNavigator` determines which values are visited from the current value.

Navigation may represent:

- object properties
- array elements
- filesystem children
- other source-specific relationships

Navigation is separate from decoding and matching:

- **Navigation** determines where to go.
- **Decoding** determines how a value is represented.
- **Matching** determines whether a navigated value participates in a discovery step.

---

## Decoding

`DiscoveryDecoder` converts a discovered value into a representation suitable for further discovery.

For example:

```text
File
  |
  v
JSON Decoder
  |
  v
Structured Object
```

Decoding is optional. A source may already provide values in a suitable structured representation.

Discovery therefore does not require all external data to use the same physical or in-memory representation.

---

## Matching

A discovery node may restrict which navigated values participate in its discovery step.

Matching evaluates conditions against the current discovery value and context. This allows discovery declarations to select relevant files, properties, array elements, or other structures.

Matching belongs to Discovery because it determines what is found, rather than how discovered data is represented relationally.

---

## Captures

Captures preserve values or metadata obtained during discovery.

A result stores captures as a `Map<string, CaptureValue>`. Captures may describe names or other contextual facts that downstream processing can use.

Captures should support describing discovered data, not become a general-purpose replacement for Import transformations. Fields derived for relational output should generally be computed during Import.

This boundary allows Discovery to identify and describe data without deciding its eventual table or column representation.

---

## Discovery Identity

`DiscoveryIdentity` describes the physical identity of a discovered value within its source and traversal context.

It is distinct from both the result ID and any logical identity assigned by Import.

- **Result ID** identifies a particular result record within a `DiscoveryResults` collection.
- **Parent result ID** establishes a relationship between result records.
- **Discovery identity** describes the physical or structural identity of the discovered value.
- **Import identity** associates discovered contributions with logical relational rows.

These identities serve different purposes and must not be treated as interchangeable.

---

## Discovery Results

Discovery produces a `DiscoveryResults` collection containing `DiscoveryResult` records.

Each result has the following fields:

| Field | Meaning |
|---|---|
| `resultId` | Unique, branded result ID within the collection |
| `parentResultId` | Parent result ID, or `null` for a root result |
| `nodeType` | Type/name of the discovery node that produced the result |
| `identity` | Physical `DiscoveryIdentity` |
| `value` | Discovered `DiscoveryValue` |
| `captures` | Captured values and metadata |

`DiscoveryResults` assigns sequential result IDs as results are created and stores records in a map keyed by those IDs. `getAll()` exposes the collection as a read-only array snapshot.

The collection represents relationships through `parentResultId`, not through nested `children` arrays. Result IDs—not physical identities—define relationships between result records.

The parent references form the discovery result graph. Consumers can use those references to navigate relationships without requiring cyclic object references or recursive result objects.

The result fields are declared readonly, but this should not be interpreted as deep immutability of every contained value or capture map.

---

## Relational Staging Interface

Discovery results can be exposed to the query infrastructure as a relational staging source.

The staging interface provides columns corresponding to the result fields:

| Column | SQL type | Nullable |
|---|---|---|
| `resultId` | `SQL_INTEGER` | No |
| `parentResultId` | `SQL_INTEGER` | Yes |
| `nodeType` | `SQL_VARCHAR` | No |
| `identity` | `SQL_JSON` | No |
| `value` | `SQL_JSON` | Yes |
| `captures` | `SQL_JSON` | No |

This interface allows Import to filter results by node type, inspect captures, extract structured values through the expression system, and navigate result relationships using IDs.

The staging interface does not make Discovery responsible for relational transformation. It provides a queryable representation of discovery output for downstream processing.

---

## Relationship to Import

Discovery answers:

> Where is the data, and what was discovered?

Import answers:

> How should discovered data become relational data?

The boundary is:

```text
Discovery
    |
    | DiscoveryResults
    v
Relational Staging Interface
    |
    v
Import
    |
    v
Relational Data
```

Discovery does not determine whether a discovered value becomes a table, a column, a child relation, a derived field, or an omitted value. Those decisions belong to Import.

Import may use result IDs and parent relationships to associate discovered values, rather than relying on captures to encode all contextual relationships.

Structured values remain accessible through the shared expression system. Import should not need to depend directly on a dialect-specific JSON function merely to inspect a discovered value.

---

## Design Principles

- Discovery locates and describes data; Import determines its relational representation.
- Discovery is independent of the target relational schema and business validation.
- Discovery abstracts over physical source types.
- Navigation, decoding, and matching are separate concerns.
- Captures preserve discovery metadata; relational derivations generally belong to Import.
- Result IDs define relationships between result records; physical identities serve a separate purpose.
- The result collection represents parent relationships through IDs rather than nested child objects.
- Discovery results provide a staging interface for Import without making Discovery dependent on relational transformation.