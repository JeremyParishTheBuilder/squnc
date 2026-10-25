# Discovery Module Overview

## Purpose

The Discovery module locates and describes structured data from external sources. It converts physical source contents into a collection of `DiscoveryResult` records that downstream processing can query.

Discovery answers:

- What data was found?
- Where was it found?
- What kind of result does it represent?
- What relationships exist between discovered results?
- What values, captures, and metadata describe each result?

Discovery does not determine how results become relational tables or define business validation rules. Those responsibilities belong to downstream modules.

## High-Level Architecture

```text
Physical Source
      |
      v
DiscoveryRoot
      |
      v
DiscoveryNode traversal
      |
      v
DiscoveryResults
      |
      v
Relational Staging Source
      |
      v
Downstream Processing
```

The main components are:

- **Discovery sources** provide access to external data.
- **Discovery roots** initialize and coordinate a discovery run.
- **Discovery nodes** define traversal, matching, decoding, and result creation.
- **Discovery contexts** carry the current value, captures, identity, and related context.
- **Discovery results** store the records produced by traversal.
- **The staging source** exposes those records through a relational query interface.

## Discovery Sources

A physical source provides access to the external data being examined, such as a filesystem hierarchy.

The source abstracts access to the underlying data so Discovery nodes can operate through the source and its discovered values rather than directly implementing source-specific access.

Filesystem objects expose properties such as `basename` and `fullPath`. These describe physical locations and are distinct from Discovery result IDs.

## Discovery Roots

A `DiscoveryRoot` combines a physical source with a root Discovery node.

A discovery run:

1. Creates a new `DiscoveryResults` collection.
2. Opens the physical source.
3. Initializes the discovery context.
4. Invokes the root node's discovery process.
5. Returns the populated results collection.

Each run produces its own collection. Result IDs are local to that collection; combining results from separate runs requires care to avoid ID collisions.

## Discovery Nodes

A `DiscoveryNode` defines a step in the discovery process. Depending on its configuration, a node can:

- Navigate to candidate values.
- Match candidates against discovery criteria.
- Decode or interpret discovered values.
- Capture named values from the current context.
- Invoke further discovery nodes for matched results.

Nodes describe how data is found and represented, rather than how it is ultimately stored in relational tables.

## Navigation

Navigation determines which candidate values a node examines.

Navigators separate traversal logic from node matching and decoding. For example, a directory navigator can enumerate a directory's contents, while other navigators can traverse structured properties or elements.

Navigation establishes the candidates available to a node. It does not itself guarantee that a candidate becomes a result; matching and the node's discovery logic determine which candidates are accepted.

## Matching and Decoding

**Matching** determines whether a candidate satisfies a node's criteria.

**Decoding** interprets or converts a candidate into the value represented by a result. Structured data may require decoding before its properties or elements can be examined by subsequent nodes.

These responsibilities are distinct: navigation finds candidates, matching selects relevant candidates, and decoding determines their interpreted representation.

## Captures and Metadata

Captures are named values collected during discovery and stored on each result. They can preserve contextual information that may be useful to downstream processing.

Metadata describes additional information about a result, such as its physical source, position within structured data, or processing details.

Metadata is adapted into a structured value. The adapter always returns an object; when no metadata fields are available, the result is an empty object (`{}`).

Captures and metadata serve different purposes:

- **Captures** preserve named values collected by Discovery.
- **Metadata** describes the result and its origin or processing.
- **Value** contains the discovered value itself.

Discovery should preserve useful source information without taking responsibility for deriving the final relational representation.

## Discovery Identity

Discovery distinguishes result relationships from physical identity.

- **`resultId`** identifies a result within its `DiscoveryResults` collection.
- **`parentResultId`** identifies the parent result, or is `null` for a root result.
- **`identity`** is the physical `DiscoveryIdentity` describing the discovered source location.

These identifiers serve different purposes. Physical identity must not be used as a substitute for result IDs when expressing relationships between records.

## Discovery Results

Each `DiscoveryResult` contains:

- `resultId`: unique ID within its collection.
- `parentResultId`: parent result ID, or `null`.
- `nodeType`: identifies the Discovery node type that produced the result.
- `identity`: physical `DiscoveryIdentity`.
- `value`: discovered value.
- `metadata`: structured descriptive metadata.
- `captures`: named captured values.

`DiscoveryResults` stores results keyed by `DiscoveryResultId` and exposes them through `getAll()`. Result relationships are represented by `parentResultId`; results do not depend on nested `children` arrays.

This separates the identity of a result record from the physical identity of the value it represents, and allows the result graph to be represented relationally.

## Relational Staging Interface

The staging source exposes Discovery results as rows for downstream querying. Its columns are:

| Column | SQL type | Nullable |
|---|---|---|
| `resultId` | `SQL_INTEGER` | No |
| `parentResultId` | `SQL_INTEGER` | Yes |
| `nodeType` | `SQL_VARCHAR` | No |
| `identity` | `SQL_JSON` | No |
| `value` | `SQL_JSON` | Yes |
| `metadata` | `SQL_JSON` | No |
| `captures` | `SQL_JSON` | No |

The staging adapter converts Discovery data into values supported by the relational query system. Structured values, metadata, and captures are exposed through this interface rather than requiring consumers to inspect internal Discovery objects directly.

The staging contract defines the data exposed to consumers. It does not prescribe the transformations consumers perform on that data.

## Relationship to Other Modules

Discovery is responsible for locating data and producing a consistent representation of the results.

The relational staging source provides the boundary through which downstream modules can consume those results. Import can use this interface to transform discovered data into relational data, but the Discovery model is not defined by Import's rulesets, SQL statements, or target schema.

Discovery does not perform automatic relational schema inference, construct application-specific database schemas, or execute Import rulesets.

## Design Principles

- Separate physical traversal from interpretation of discovered data.
- Represent discovered records explicitly and consistently.
- Use result IDs for result relationships and physical identities for source identity.
- Store parent relationships through IDs rather than nested child collections.
- Preserve useful captures and source metadata.
- Expose results through a relational staging interface.
- Keep Discovery independent of downstream transformation rules and relational schemas.