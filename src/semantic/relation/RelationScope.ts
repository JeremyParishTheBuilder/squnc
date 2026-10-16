import { normalizeIdentifier } from "../../utils/normalizeIdentifier.js";
import type { ColumnBinder } from "./ColumnBinder.js";
import type { ColumnResolver } from "./ColumnResolver.js";
import type { RelationBinding } from "./RelationBinding.js";
import type { RelationColumn } from "./RelationColumn.js";
import type { ResolvedColumn } from "./ResolvedColumn.js";

export class RelationScope implements ColumnResolver, ColumnBinder {
  constructor(public readonly relations: readonly RelationBinding[]) {}

  public resolveColumn(reference: string): ResolvedColumn {
    const parsed = parseColumnReference(reference);

    const relationName = parsed.relationName
      ? normalizeIdentifier(parsed.relationName)
      : undefined;

    const columnName = normalizeIdentifier(parsed.columnName);

    if (relationName) {
      const relation = requireRelationBinding(relationName, this.relations);

      const column = requireColumnFromRelation(columnName, relation);

      return {
        relationName,
        column: column,
      };
    }

    return requireResolvedColumnFromRelations(columnName, this.relations);
  }

  public requireColumnPosition(column: ResolvedColumn): number {
    let position = 0;

    for (const relation of this.relations) {
      for (const relationColumn of relation.columns) {
        if (matches(relation, relationColumn, column)) {
          return position;
        }

        position++;
      }
    }

    throw new Error(`Column not found`);
  }
}

function matches(
  relation: RelationBinding,
  relationColumn: RelationColumn,
  column: ResolvedColumn,
): boolean {
  if (
    relation.name !== undefined &&
    column.relationName !== undefined &&
    normalizeIdentifier(relation.name) !==
      normalizeIdentifier(column.relationName)
  ) {
    return false;
  }

  if (relationColumn.columnId !== undefined) {
    return relationColumn.columnId === column.column.columnId;
  }

  return (
    normalizeIdentifier(relationColumn.column.name) ===
    normalizeIdentifier(column.column.column.name)
  );
}

function parseColumnReference(reference: string): {
  relationName?: string;
  columnName: string;
} {
  const parts = reference.split(".");

  if (parts.length === 1) {
    return {
      columnName: parts[0],
    };
  }

  if (parts.length === 2) {
    return {
      relationName: parts[0],
      columnName: parts[1],
    };
  }

  throw new Error(`Invalid column reference: ${reference}`);
}

function requireRelationBinding(
  relationName: string,
  relations: readonly RelationBinding[],
): RelationBinding {
  const candidateRelations: RelationBinding[] = relations.filter(
    (r) => r.name !== undefined && normalizeIdentifier(r.name) === relationName,
  );

  if (candidateRelations.length < 1) {
    throw new Error(`No relation binding matches given relation name`);
  }

  if (candidateRelations.length > 1) {
    throw new Error(`Relation binding name is ambiguous`);
  }

  return candidateRelations[0];
}

function requireResolvedColumnFromRelations(
  columnName: string,
  relations: readonly RelationBinding[],
): ResolvedColumn {
  const candidateColumns: ResolvedColumn[] = [];

  for (const relation of relations) {
    const candidateRelationColumns: RelationColumn[] =
      getCandidateColumnsFromRelation(columnName, relation);

    const candidateResolvedColumns = candidateRelationColumns.map((crc) => {
      return {
        relation: relation.name,
        column: crc,
      };
    });

    candidateColumns.push(...candidateResolvedColumns);
  }

  if (candidateColumns.length < 1) {
    throw new Error(`No column matches given column reference`);
  }

  if (candidateColumns.length > 1) {
    throw new Error(
      `Column reference (name: ${columnName}) is ambiguous among relations`,
    );
  }

  return candidateColumns[0];
}

function getCandidateColumnsFromRelation(
  columnName: string,
  relation: RelationBinding,
): RelationColumn[] {
  return relation.columns.filter(
    (rc) => normalizeIdentifier(rc.column.name) === columnName,
  );
}

function requireColumnFromRelation(
  columnName: string,
  relation: RelationBinding,
): RelationColumn {
  const candidateColumns = getCandidateColumnsFromRelation(
    columnName,
    relation,
  );

  if (candidateColumns.length < 1) {
    throw new Error(`No column matches given column name`);
  }

  if (candidateColumns.length > 1) {
    throw new Error(
      `Relation column name: ${columnName} is ambiguous within relation: ${relation.name}`,
    );
  }

  return candidateColumns[0];
}
