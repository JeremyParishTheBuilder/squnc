import { type Action } from "../actions/Action.js";
import { AddCheckAction } from "../actions/AddCheckAction.js";
import { AddColumnAction } from "../actions/AddColumnAction.js";
import { AddForeignKeyAction } from "../actions/AddForeignKeyAction.js";
import { AddPrimaryKeyAction } from "../actions/AddPrimaryKeyAction.js";
import { DropForeignKeyAction } from "../actions/DropForeignKeyAction.js";

import {
  type AddColumnOperation,
  type AddConstraintOperation,
  type AddIndexOperation,
  type AlterTableOperation,
  type AlterTableStatement,
  type ColumnRename,
  type ConstraintRename,
  type DropColumnDefaultOperation,
  type DropColumnNotNullOperation,
  type DropColumnOperation,
  type DropConstraintOperation,
  type DropIndexOperation,
  type DropPrimaryKeyOperation,
  type IndexRename,
  type RenameColumnsOperation,
  type RenameConstraintsOperation,
  type RenameIndexesOperation,
  type RenameTableOperation,
  type SetColumnDefaultOperation,
  type SetColumnNotNullOperation,
  type SetColumnTypeOperation,
} from "../statements/index.js";
import { CONSTRAINT_KIND } from "../relational/ConstraintKind.js";
import { PrimaryKey } from "../relational/PrimaryKey.js";
import { ForeignKey } from "../relational/ForeignKey.js";
import { Unique } from "../relational/Unique.js";
import { Check } from "../relational/Check.js";
import { type SemanticAnalyzer } from "./SemanticAnalyzer.js";
import { DropPrimaryKeyAction } from "../actions/DropPrimaryKeyAction.js";
import { DropCheckAction } from "../actions/DropCheckAction.js";
import { DropIndexAction } from "../actions/DropIndexAction.js";
import { AddIndexAction } from "../actions/AddIndexAction.js";
import { DropUniqueAction } from "../actions/DropUniqueAction.js";
import { AddUniqueConstraintAction } from "../actions/AddUniqueConstraintAction.js";
import { DropColumnAction } from "../actions/DropColumnAction.js";
import { AlterColumnSetTypeAction } from "../actions/AlterColumnSetTypeAction.js";
import { normalizeIdentifier } from "../utils/normalizeIdentifier.js";
import { RenameColumnsAction } from "../actions/RenameColumnsAction.js";
import {
  AlterTableSchema,
  type TableSchemaColumn,
  type TableSchemaConstraint,
  type TableSchemaIndex,
} from "./AlterTableSchema.js";
import { ResolvedPredicateColumnCollector } from "../utils/PredicateColumnCollector.js";
import { resolvePredicate } from "./predicate.js";
import { assertNever } from "../utils/assertNever.js";
import { IdAllocator } from "../types/IdAllocator.js";
import { RenameTableAction } from "../actions/RenameTableAction.js";
import { matchesSqlType } from "../types/SqlType.js";
import { RenameConstraintsAction } from "../actions/RenameConstraintsAction.js";
import { AlterColumnSetNotNullAction } from "../actions/AlterColumnSetNotNullAction.js";
import { AlterColumnDropNotNullAction } from "../actions/AlterColumnDropNotNullAction.js";
import { AlterColumnSetDefaultAction } from "../actions/AlterColumnSetDefaultAction.js";
import { AlterColumnDropDefaultAction } from "../actions/AlterColumnDropDefaultAction.js";
import { RenameIndexesAction } from "../actions/RenameIndexesAction.js";

export type PlanId = number & { readonly __brand: "PlanId" };

interface PlannedSubAction<T> {
  subAction: T;
  planId?: PlanId;
}

interface PlannedCompositeAction<T> {
  subActions: PlannedSubAction<T>[];
  createAction(subActions: T[]): Action | undefined;
}

type PlannedAction =
  | {
      kind: "single";
      action: Action;
      planId?: PlanId;
    }
  | {
      kind: "composite";
      finalize: (cancelledPlanIds: Set<PlanId>) => Action | undefined;
    };

function finalizeCompositeAction<T>(
  planned: PlannedCompositeAction<T>,
  cancelledPlanIds: Set<PlanId>,
): Action | undefined {
  const survivingSubActions = planned.subActions
    .filter(
      ({ planId }) => planId === undefined || !cancelledPlanIds.has(planId),
    )
    .map(({ subAction }) => subAction);

  return planned.createAction(survivingSubActions);
}

function finalizePlannedActions(
  plannedActions: PlannedAction[],
  cancelledPlanIds: Set<PlanId>,
): Action[] {
  const actions: Action[] = [];

  for (const planned of plannedActions) {
    if (planned.kind === "single") {
      if (
        planned.planId === undefined ||
        !cancelledPlanIds.has(planned.planId)
      ) {
        actions.push(planned.action);
      }

      continue;
    }

    const action = planned.finalize(cancelledPlanIds);

    if (action !== undefined) {
      actions.push(action);
    }
  }

  return actions;
}

export function bindAlterTable(
  semantic: SemanticAnalyzer,
  stmt: AlterTableStatement,
) {
  const ctx = semantic.ctx;

  const plannedActions: PlannedAction[] = [];

  const dbName = ctx.requireDatabase().name;
  const tableName = stmt.table;
  const table = ctx.requireTable(tableName);

  let workingSchema = AlterTableSchema.fromTable(table);
  let planIds = new IdAllocator<PlanId>();
  const cancelledPlanIds = new Set<PlanId>();
  let tableRenamed = false;

  for (const operation of stmt.operations) {
    let planId: PlanId | undefined;

    if (
      operation.op === "add_column" ||
      operation.op === "add_constraint" ||
      operation.op === "add_index"
    ) {
      const [id, nextIds] = planIds.allocate();
      planId = id;
      planIds = nextIds;
    }

    if (operation.op === "rename_table") {
      if (tableRenamed) {
        throw new Error("Table cannot be renamed twice in one statement");
      }

      tableRenamed = true;
    }

    const result = bindAlterTableOperation(
      semantic,
      dbName,
      workingSchema,
      operation,
      planId,
    );

    plannedActions.push(...result.actions);
    workingSchema = result.workingSchema;

    if (result.cancelledPlanId !== undefined) {
      cancelledPlanIds.add(result.cancelledPlanId);
    }
  }

  return finalizePlannedActions(plannedActions, cancelledPlanIds);
}

function bindAlterTableOperation(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: AlterTableOperation,
  planId?: PlanId,
): {
  actions: PlannedAction[];
  workingSchema: AlterTableSchema;
  cancelledPlanId?: PlanId;
} {
  switch (operation.op) {
    case "rename_table": {
      return bindAlterTableRenameTable(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "add_constraint": {
      if (planId === undefined) {
        throw new Error(`PlanId missing for ADD alteration`);
      }

      return bindAlterTableAddConstraint(
        semantic,
        dbName,
        workingSchema,
        operation,
        planId,
      );
    }

    case "drop_constraint": {
      return bindAlterTableDropConstraint(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "drop_primary_key": {
      return bindAlterTableDropPrimaryKey(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "rename_constraints": {
      return bindAlterTableRenameConstraints(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "add_column": {
      if (planId === undefined) {
        throw new Error(`PlanId missing for ADD alteration`);
      }

      return bindAlterTableAddColumn(
        semantic,
        dbName,
        workingSchema,
        operation,
        planId,
      );
    }

    case "drop_column": {
      return bindAlterTableDropColumn(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "rename_columns": {
      return bindAlterTableRenameColumns(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "set_column_type": {
      return bindAlterTableSetColumnType(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "set_column_default": {
      return bindAlterTableSetColumnDefault(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "drop_column_default": {
      return bindAlterTableDropColumnDefault(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "set_column_not_null": {
      return bindAlterTableSetColumnNotNull(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "drop_column_not_null": {
      return bindAlterTableDropColumnNotNull(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "rename_indexes": {
      return bindAlterTableRenameIndexes(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    case "add_index": {
      if (planId === undefined) {
        throw new Error(`PlanId missing for ADD alteration`);
      }

      return bindAlterTableAddIndex(
        semantic,
        dbName,
        workingSchema,
        operation,
        planId,
      );
    }

    case "drop_index": {
      return bindAlterTableDropIndex(
        semantic,
        dbName,
        workingSchema,
        operation,
      );
    }

    default:
      return assertNever(operation);
  }
}

function bindAlterTableRenameTable(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: RenameTableOperation,
) {
  const actions: PlannedAction[] = [];

  const db = semantic.ctx.requireDatabase(dbName);
  const oldName = workingSchema.name;
  const newName = operation.newName;
  const normalizedNewName = normalizeIdentifier(newName);

  if (
    normalizeIdentifier(oldName) !== normalizedNewName &&
    db.tables.hasName(normalizedNewName)
  ) {
    throw new Error(`New Table Name ${newName} already used`);
  }

  actions.push({
    kind: "single",
    action: new RenameTableAction(dbName, oldName, newName),
  });

  return {
    actions,
    workingSchema: workingSchema.renameTable(newName),
  };
}

function bindAlterTableAddConstraint(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: AddConstraintOperation,
  planId: PlanId,
) {
  const actions: PlannedAction[] = [];

  const ctx = semantic.ctx;
  const tableName = workingSchema.name;

  const spec = operation.constraint;

  let columns: TableSchemaColumn[] = [];
  if ("columns" in spec && spec.columns) {
    columns = spec.columns.map((c) => workingSchema.requireColumn(c));
  }

  switch (spec.kind) {
    case CONSTRAINT_KIND.foreignKey: {
      const parentTable = ctx.requireTable(spec.parentTable);
      spec.parentColumns.map((c) => parentTable.columns.requireIdByName(c));

      if (!ctx.rules.constraints.allowNullableForeignKeys) {
        for (const col of columns) {
          if (col.nullable) {
            throw new Error(
              `Foreign key column '${col.name}' cannot be nullable`,
            );
          }
        }
      }

      const reverseIndexName = ForeignKey.defaultIndexName(spec.name);

      const onDelete =
        spec.onDelete ?? ctx.rules.constraints.foreignKeyDefaultOnDelete;
      const onUpdate =
        spec.onUpdate ?? ctx.rules.constraints.foreignKeyDefaultOnUpdate;

      actions.push({
        kind: "single",
        action: new AddForeignKeyAction(dbName, tableName, {
          ...spec,
          onDelete,
          onUpdate,
          reverseIndex: reverseIndexName,
        }),
        planId,
      });

      const schemaConstraint: TableSchemaConstraint = {
        name: spec.name,
        kind: spec.kind,
        columns: columns.map((c) => c.identity),
        identity: {
          kind: "planned",
          planId: planId,
        },
      };

      workingSchema = workingSchema.withConstraint(schemaConstraint);

      break;
    }

    case CONSTRAINT_KIND.primaryKey: {
      if ((spec.columns === undefined) === (spec.using === undefined)) {
        throw new Error(
          "PRIMARY KEY constraint requires exactly one of 'columns' or 'using'.",
        );
      }

      let indexId;
      let columnIds;
      if (spec.using) {
        const index = workingSchema.requireIndex(spec.using);
        indexId = index.identity;
        columnIds = index.columns;
      } else {
        if (columns.length <= 0) {
          throw new Error(`No columns referenced by Unique Constriant`);
        }
        columnIds = columns?.map((c) => c.identity);
      }

      actions.push({
        kind: "single",
        action: new AddPrimaryKeyAction(dbName, tableName, {
          name: spec.name,
          columns: spec.columns,
          using: spec.using,
          nullsDistinct: ctx.rules.constraints.nullsDistinct,
        }),
        planId,
      });

      const schemaConstraint: TableSchemaConstraint = {
        name: spec.name,
        kind: spec.kind,
        columns: columnIds,
        index: indexId,
        identity: {
          kind: "planned",
          planId: planId,
        },
      };

      workingSchema = workingSchema.withConstraint(schemaConstraint);

      break;
    }

    case CONSTRAINT_KIND.unique: {
      if ((spec.columns === undefined) === (spec.using === undefined)) {
        throw new Error(
          "UNIQUE constraint requires exactly one of 'columns' or 'using'.",
        );
      }

      let indexId;
      let columnIds;
      if (spec.using) {
        const index = workingSchema.requireIndex(spec.using);
        indexId = index.identity;
        columnIds = index.columns;
      } else {
        if (columns.length <= 0) {
          throw new Error(`No columns referenced by Unique Constriant`);
        }
        columnIds = columns?.map((c) => c.identity);
      }

      actions.push({
        kind: "single",
        action: new AddUniqueConstraintAction(dbName, tableName, {
          name: spec.name,
          columns: spec.columns,
          using: spec.using,
          nullsDistinct: ctx.rules.constraints.nullsDistinct,
        }),
        planId,
      });

      const schemaConstraint: TableSchemaConstraint = {
        name: spec.name,
        kind: spec.kind,
        columns: columnIds,
        index: indexId,
        identity: {
          kind: "planned",
          planId: planId,
        },
      };

      workingSchema = workingSchema.withConstraint(schemaConstraint);

      break;
    }

    case CONSTRAINT_KIND.check: {
      const referencedColumns = ResolvedPredicateColumnCollector.collect(
        resolvePredicate(spec.predicate, workingSchema),
      );

      actions.push({
        kind: "single",
        action: new AddCheckAction(dbName, tableName, spec),
        planId,
      });

      const schemaConstraint: TableSchemaConstraint = {
        name: spec.name,
        kind: spec.kind,
        columns: referencedColumns
          .map((rc) => rc.column.column.name)
          .map((cn) => workingSchema.requireColumn(cn).identity),
        identity: {
          kind: "planned",
          planId: planId,
        },
      };

      workingSchema = workingSchema.withConstraint(schemaConstraint);

      break;
    }

    default:
      return assertNever(spec);
  }

  return {
    actions,
    workingSchema,
  };
}

function bindAlterTableDropConstraint(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: DropConstraintOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const constraintName = operation.constraintName;
  const constraint = workingSchema.requireConstraint(constraintName);

  let cancelledPlanId;

  if (constraint.identity.kind === "planned") {
    cancelledPlanId = constraint.identity.planId;
  } else {
    const tableConstraint = semantic.ctx
      .requireTable(workingSchema.name)
      .requireConstraintByName(constraint.name);

    if (tableConstraint instanceof PrimaryKey) {
      actions.push({
        kind: "single",
        action: new DropPrimaryKeyAction(dbName, tableName),
      });
    } else if (tableConstraint instanceof Unique) {
      actions.push({
        kind: "single",
        action: new DropUniqueAction(dbName, tableName, tableConstraint.id),
      });
    } else if (tableConstraint instanceof ForeignKey) {
      actions.push({
        kind: "single",
        action: new DropForeignKeyAction(dbName, tableName, tableConstraint.id),
      });
    } else if (tableConstraint instanceof Check) {
      actions.push({
        kind: "single",
        action: new DropCheckAction(dbName, tableName, tableConstraint.id),
      });
    } else {
      throw new Error(`Invalid Constraint detected: ${constraint}`);
    }
  }

  return {
    actions,
    workingSchema: workingSchema.withoutConstraint(constraintName),
    cancelledPlanId,
  };
}

function bindAlterTableRenameConstraints(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: RenameConstraintsOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const maxConstraintRenames = semantic.ctx.rules.dml.maxConstraintRenames;
  if (
    maxConstraintRenames !== null &&
    operation.constraintRenames.length > maxConstraintRenames
  ) {
    throw new Error(
      `Too many constraint renames: maximum is ${maxConstraintRenames}`,
    );
  }

  const sourceConstraints = new Map<string, TableSchemaConstraint>();
  const destinationNames = new Set<string>();

  // Phase 1: Resolve sources and reject duplicate sources.
  const resolvedRenames = operation.constraintRenames.map((rename) => {
    const constraint = workingSchema.requireConstraint(rename.from);

    const planId =
      constraint.identity.kind === "planned"
        ? constraint.identity.planId
        : undefined;

    if (sourceConstraints.has(normalizeIdentifier(constraint.name))) {
      throw new Error(
        `Duplicate source constraint "${constraint.name}" in RENAME COINSTRAINT statement`,
      );
    }

    sourceConstraints.set(normalizeIdentifier(constraint.name), constraint);

    return {
      constraint,
      from: rename.from,
      to: rename.to,
      normalizedTo: normalizeIdentifier(rename.to),
      planId,
    };
  });

  // Phase 2: Reject duplicate destinations.
  for (const rename of resolvedRenames) {
    if (destinationNames.has(rename.normalizedTo)) {
      throw new Error(
        `Duplicate destination constraint "${rename.to}" in RENAME CONSTRAINT statement`,
      );
    }

    destinationNames.add(rename.normalizedTo);
  }

  // Phase 3: Reject collisions with constraints that are not being renamed.
  for (const rename of resolvedRenames) {
    const existingConstraint = workingSchema.getConstraint(rename.to);

    if (
      existingConstraint !== undefined &&
      !sourceConstraints.has(normalizeIdentifier(existingConstraint.name))
    ) {
      throw new Error(
        `Replacement constraint name "${rename.to}" already taken`,
      );
    }
  }

  const action: PlannedCompositeAction<ConstraintRename> = {
    subActions: resolvedRenames.map((rename) => ({
      subAction: {
        from: rename.from,
        to: rename.to,
      },
      planId: rename.planId,
    })),

    createAction: (renames) =>
      renames.length === 0
        ? undefined
        : new RenameConstraintsAction(dbName, tableName, renames),
  };

  actions.push({
    kind: "composite",
    finalize: (cancelledPlanIds) =>
      finalizeCompositeAction(action, cancelledPlanIds),
  });

  return {
    actions,
    workingSchema: workingSchema.renameConstraints(
      resolvedRenames.map(({ from, to }) => ({ from, to })),
    ),
  };
}

function bindAlterTableDropPrimaryKey(
  _semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  _operation: DropPrimaryKeyOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const constraint = workingSchema.requirePrimaryKey();
  const constraintName = constraint.name;

  let cancelledPlanId;

  if (constraint.identity.kind === "planned") {
    cancelledPlanId = constraint.identity.planId;
  } else {
    actions.push({
      kind: "single",
      action: new DropPrimaryKeyAction(dbName, tableName),
    });
  }

  return {
    actions,
    workingSchema: workingSchema.withoutConstraint(constraintName),
    cancelledPlanId,
  };
}

function bindAlterTableAddColumn(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: AddColumnOperation,
  planId: PlanId,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const spec = operation.columnSpec;

  actions.push({
    kind: "single",
    action: new AddColumnAction(
      dbName,
      tableName,
      spec,
      semantic.ctx.rules.autoIncrementColumnPolicy,
    ),
    planId,
  });

  const schemaColumn: TableSchemaColumn = {
    name: spec.name,
    type: spec.type,
    nullable: spec.nullable ?? true,
    identity: {
      kind: "planned",
      planId,
    },
  };

  return {
    actions,
    workingSchema: workingSchema.withColumn(schemaColumn),
  };
}

function bindAlterTableDropColumn(
  _semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: DropColumnOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const columnName = operation.columnName;
  const column = workingSchema.requireColumn(columnName);

  let cancelledPlanId;

  if (column.identity.kind === "planned") {
    cancelledPlanId = column.identity.planId;
  } else {
    actions.push({
      kind: "single",
      action: new DropColumnAction(dbName, tableName, column.identity.columnId),
    });
  }

  return {
    actions,
    workingSchema: workingSchema.withoutColumn(columnName),
    cancelledPlanId,
  };
}

function bindAlterTableRenameColumns(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: RenameColumnsOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const maxColumnRenames = semantic.ctx.rules.dml.maxColumnRenames;
  if (
    maxColumnRenames !== null &&
    operation.columnRenames.length > maxColumnRenames
  ) {
    throw new Error(`Too many column renames: maximum is ${maxColumnRenames}`);
  }

  const sourceColumns = new Map<string, TableSchemaColumn>();
  const destinationNames = new Set<string>();

  // Phase 1: Resolve sources and reject duplicate sources.
  const resolvedRenames = operation.columnRenames.map((rename) => {
    const column = workingSchema.requireColumn(rename.from);

    const planId =
      column.identity.kind === "planned" ? column.identity.planId : undefined;

    if (sourceColumns.has(normalizeIdentifier(column.name))) {
      throw new Error(
        `Duplicate source column "${column.name}" in RENAME COLUMN statement`,
      );
    }

    sourceColumns.set(normalizeIdentifier(column.name), column);

    return {
      column,
      from: rename.from,
      to: rename.to,
      normalizedTo: normalizeIdentifier(rename.to),
      planId,
    };
  });

  // Phase 2: Reject duplicate destinations.
  for (const rename of resolvedRenames) {
    if (destinationNames.has(rename.normalizedTo)) {
      throw new Error(
        `Duplicate destination column "${rename.to}" in RENAME COLUMN statement`,
      );
    }

    destinationNames.add(rename.normalizedTo);
  }

  // Phase 3: Reject collisions with columns that are not being renamed.
  for (const rename of resolvedRenames) {
    const existingColumn = workingSchema.getColumn(rename.to);

    if (
      existingColumn !== undefined &&
      !sourceColumns.has(normalizeIdentifier(existingColumn.name))
    ) {
      throw new Error(`Replacement column name "${rename.to}" already taken`);
    }
  }

  const action: PlannedCompositeAction<ColumnRename> = {
    subActions: resolvedRenames.map((rename) => ({
      subAction: {
        from: rename.from,
        to: rename.to,
      },
      planId: rename.planId,
    })),

    createAction: (renames) =>
      renames.length === 0
        ? undefined
        : new RenameColumnsAction(dbName, tableName, renames),
  };

  actions.push({
    kind: "composite",
    finalize: (cancelledPlanIds) =>
      finalizeCompositeAction(action, cancelledPlanIds),
  });

  return {
    actions,
    workingSchema: workingSchema.renameColumns(
      resolvedRenames.map(({ from, to }) => ({ from, to })),
    ),
  };
}

function bindAlterTableSetColumnType(
  _semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: SetColumnTypeOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const columnName = operation.columnName;
  const column = workingSchema.requireColumn(columnName);
  const type = operation.type;

  const planId =
    column.identity.kind === "planned" ? column.identity.planId : undefined;

  actions.push({
    kind: "single",
    action: new AlterColumnSetTypeAction(dbName, tableName, columnName, type),
    planId,
  });

  return {
    actions,
    workingSchema: workingSchema.withUpdatedColumn({
      ...column,
      type,
    }),
  };
}

function bindAlterTableSetColumnNotNull(
  _semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: SetColumnNotNullOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const columnName = operation.columnName;
  const column = workingSchema.requireColumn(columnName);

  const planId =
    column.identity.kind === "planned" ? column.identity.planId : undefined;

  actions.push({
    kind: "single",
    action: new AlterColumnSetNotNullAction(dbName, tableName, columnName),
    planId,
  });

  return {
    actions,
    workingSchema: workingSchema.withUpdatedColumn({
      ...column,
      nullable: false,
    }),
  };
}

function bindAlterTableDropColumnNotNull(
  _semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: DropColumnNotNullOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const columnName = operation.columnName;
  const column = workingSchema.requireColumn(columnName);

  const planId =
    column.identity.kind === "planned" ? column.identity.planId : undefined;

  actions.push({
    kind: "single",
    action: new AlterColumnDropNotNullAction(dbName, tableName, columnName),
    planId,
  });

  return {
    actions,
    workingSchema: workingSchema.withUpdatedColumn({
      ...column,
      nullable: true,
    }),
  };
}

function bindAlterTableSetColumnDefault(
  _semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: SetColumnDefaultOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;
  const columnName = operation.columnName;
  const column = workingSchema.requireColumn(columnName);
  const defaultValue = operation.value;

  if (!matchesSqlType(defaultValue, column.type)) {
    throw new Error(
      `Default value '${defaultValue}' does not match column SQL type '${column.type}'`,
    );
  }

  // TODO - pending decision on whether default value should be an expression
  // const exprSqlType = sqlTypeFromExpression(expr);
  // if (exprSqlType !== column.type) {
  //   throw new Error(
  //     `Default value expression type '${exprSqlType}' does not match column SQL type '${column.type}'`,
  //   );
  // }

  const planId =
    column.identity.kind === "planned" ? column.identity.planId : undefined;

  actions.push({
    kind: "single",
    action: new AlterColumnSetDefaultAction(
      dbName,
      tableName,
      columnName,
      defaultValue,
    ),
    planId,
  });

  return {
    actions,
    workingSchema,
  };
}

function bindAlterTableDropColumnDefault(
  _semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: DropColumnDefaultOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;
  const columnName = operation.columnName;
  const column = workingSchema.requireColumn(columnName);

  const planId =
    column.identity.kind === "planned" ? column.identity.planId : undefined;

  actions.push({
    kind: "single",
    action: new AlterColumnDropDefaultAction(dbName, tableName, columnName),
    planId,
  });

  return {
    actions,
    workingSchema,
  };
}

function bindAlterTableRenameIndexes(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: RenameIndexesOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const maxIndexRenames = semantic.ctx.rules.dml.maxIndexRenames;
  if (
    maxIndexRenames !== null &&
    operation.indexRenames.length > maxIndexRenames
  ) {
    throw new Error(`Too many index renames: maximum is ${maxIndexRenames}`);
  }

  const sourceIndexes = new Map<string, TableSchemaIndex>();
  const destinationNames = new Set<string>();

  // Phase 1: Resolve sources and reject duplicate sources.
  const resolvedRenames = operation.indexRenames.map((rename) => {
    const index = workingSchema.requireIndex(rename.from);

    const planId =
      index.identity.kind === "planned" ? index.identity.planId : undefined;

    if (sourceIndexes.has(normalizeIdentifier(index.name))) {
      throw new Error(
        `Duplicate source index "${index.name}" in RENAME INDEX statement`,
      );
    }

    sourceIndexes.set(normalizeIdentifier(index.name), index);

    return {
      index,
      from: rename.from,
      to: rename.to,
      normalizedTo: normalizeIdentifier(rename.to),
      planId,
    };
  });

  // Phase 2: Reject duplicate destinations.
  for (const rename of resolvedRenames) {
    if (destinationNames.has(rename.normalizedTo)) {
      throw new Error(
        `Duplicate destination index "${rename.to}" in RENAME INDEX statement`,
      );
    }

    destinationNames.add(rename.normalizedTo);
  }

  // Phase 3: Reject collisions with indexes that are not being renamed.
  for (const rename of resolvedRenames) {
    const existingIndex = workingSchema.getIndex(rename.to);

    if (
      existingIndex !== undefined &&
      !sourceIndexes.has(normalizeIdentifier(existingIndex.name))
    ) {
      throw new Error(`Replacement index name "${rename.to}" already taken`);
    }
  }

  const action: PlannedCompositeAction<IndexRename> = {
    subActions: resolvedRenames.map((rename) => ({
      subAction: {
        from: rename.from,
        to: rename.to,
      },
      planId: rename.planId,
    })),

    createAction: (renames) =>
      renames.length === 0
        ? undefined
        : new RenameIndexesAction(dbName, tableName, renames),
  };

  actions.push({
    kind: "composite",
    finalize: (cancelledPlanIds) =>
      finalizeCompositeAction(action, cancelledPlanIds),
  });

  return {
    actions,
    workingSchema: workingSchema.renameIndexes(
      resolvedRenames.map(({ from, to }) => ({ from, to })),
    ),
  };
}

function bindAlterTableAddIndex(
  semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: AddIndexOperation,
  planId: PlanId,
) {
  const actions: PlannedAction[] = [];

  const ctx = semantic.ctx;
  const tableName = workingSchema.name;

  const spec = operation.index;

  actions.push({
    kind: "single",
    action: new AddIndexAction(dbName, tableName, {
      name: spec.name,
      columns: spec.columns,
      unique: spec.unique,
      internal: false,
      nullsDistinct: ctx.rules.constraints.nullsDistinct,
    }),
    planId,
  });

  const schemaIndex: TableSchemaIndex = {
    name: spec.name,
    columns: spec.columns.map(
      (name) => workingSchema.requireColumn(name).identity,
    ),
    unique: spec.unique,
    internal: false,
    identity: {
      kind: "planned",
      planId: planId,
    },
  };

  workingSchema = workingSchema.withIndex(schemaIndex);

  return {
    actions,
    workingSchema,
  };
}

function bindAlterTableDropIndex(
  _semantic: SemanticAnalyzer,
  dbName: string,
  workingSchema: AlterTableSchema,
  operation: DropIndexOperation,
) {
  const actions: PlannedAction[] = [];

  const tableName = workingSchema.name;

  const indexName = operation.indexName;
  const index = workingSchema.requireIndex(indexName);

  let cancelledPlanId;

  if (index.identity.kind === "planned") {
    cancelledPlanId = index.identity.planId;
  } else {
    actions.push({
      kind: "single",
      action: new DropIndexAction(dbName, tableName, index.identity.indexId),
    });
  }

  return {
    actions,
    workingSchema: workingSchema.withoutIndex(indexName),
    cancelledPlanId,
  };
}
