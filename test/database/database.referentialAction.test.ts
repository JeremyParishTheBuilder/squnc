import { describe, it, expect } from "vitest";
import {
  buildDatabase,
  buildTable,
  createColumnTestSpec,
  createDelete
} from "../utils/buildSchema.js";
import type { ColumnId } from "../../src/relational/Column.js";
import type { ColumnInput } from "../../src/types/ColumnInput.js";
import { SQL_DECIMAL } from "../../src/types/SqlType.js";

describe("Database Referential Actions", () => {

  it("rejects deleting parent row under RESTRICT", () => {
    let parent = buildTable({name: "Parent"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "PK_PARENT",
        columns: ["ID"],
        unique: true,
      });
    
    parent = parent.addRows([
      [1],
    ]);

    let child = buildTable({name: "Child"})
      .createColumn(createColumnTestSpec({
        name: "ParentID",
        type: SQL_DECIMAL,
      }));

    child = child.addRows([
      [1],
    ]);

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey(
        "Child",
        {
          name: "FK_CHILD_PARENT",
          columns: ["ParentID"],
          reverseIndex: "FKRI_Id",
          parentTable: "Parent",
          parentColumns: ["ID"],
          onDelete: "restrict",
          onUpdate: "restrict",
        }
      );

    expect(() =>
      db.removeRows("Parent", [createDelete(parent, 0)])
    ).toThrow();
  });

  it("cascades delete to child rows", () => {
    let parent = buildTable({name: "Parent"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "PK_PARENT",
        columns: ["ID"],
        unique: true,
      });
    
    parent = parent.addRows([
      [1],
    ]);

    let child = buildTable({name: "Child"})
      .createColumn(createColumnTestSpec({
        name: "ParentID",
        type: SQL_DECIMAL,
      }));

    child = child.addRows([
      [1],
    ]);

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey(
        "Child",
        {
          name: "FK_CHILD_PARENT",
          columns: ["ParentID"],
          reverseIndex: "FKRI_Id",
          parentTable: "Parent",
          parentColumns: ["ID"],
          onDelete: "cascade",
          onUpdate: "restrict",
        }
      );

    const updated = db.removeRows("Parent", [createDelete(parent, 0)]);

    expect(
      updated.tables.requireByName("Child").rowAlive[0]
    ).toBe(false);
  });

  it("sets child foreign key values to null during SET NULL delete", () => {
    let parent = buildTable({name: "Parent"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      });

    parent = parent.addRows([
      [1],
    ]);

    let child = buildTable({name: "Child"})
      .createColumn(createColumnTestSpec({
        name: "ParentID",
        type: SQL_DECIMAL,
        nullable: true,
      }));

    child = child.addRows([
      [1],
    ]);

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey(
        "Child",
        {
          name: "FK_CHILD_PARENT",
          columns: ["ParentID"],
          reverseIndex: "FKRI_Id",
          parentTable: "Parent",
          parentColumns: ["ID"],
          onDelete: "setNull",
          onUpdate: "restrict",
        }
      );

    const updated = db.removeRows("Parent", [createDelete(parent, 0)]);

    expect(
      updated.tables.requireByName("Child").requireRow(0)
    ).toEqual([null]);
  });

  it("cascades updates to child rows", () => {
    let parent = buildTable({name: "Parent"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "PK_PARENT",
        columns: ["ID"],
        unique: true,
      });

    parent = parent.addRows([
      [1],
    ]);

    let child = buildTable({name: "Child"})
      .createColumn(createColumnTestSpec({
        name: "ParentID",
        type: SQL_DECIMAL,
      }));

    child = child.addRows([
      [1],
    ]);

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey(
        "Child",
        {
          name: "FK_CHILD_PARENT",
          columns: ["ParentID"],
          reverseIndex: "FKRI_Id",
          parentTable: "Parent",
          parentColumns: ["ID"],
          onDelete: "restrict",
          onUpdate: "cascade",
        }
      );

    const updates = [2];

    const updated = db.updateRows(
      "Parent", [0], [updates]
    );

    expect(
      updated.tables.requireByName("Child").requireRow(0)
    ).toEqual([2]);
  });

  it("supports self-referencing cascade deletes", () => {
    let table = buildTable({name: "Node"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({
        name: "ParentID",
        type: SQL_DECIMAL,
        nullable: true,
      }))
      .createIndex({
        name: "PK_NODE",
        columns: ["ID"],
        unique: true,
      });

    table = table.addRows([
      [1, null],
      [2, 1],
    ]);

    const db = buildDatabase()
      .addTable(table)
      .createForeignKey(
        "Node",
        {
          name: "FK_NODE_PARENT",
          columns: ["ParentID"],
          reverseIndex: "FKRI_Id",
          parentTable: "Node",
          parentColumns: ["ID"],
          onDelete: "cascade",
          onUpdate: "cascade",
        }
      );

    const updated = db.removeRows("Node", [createDelete(table, 0)]);

    expect(
      updated.tables.requireByName("Node").rowAlive[0]
    ).toBe(false);

    expect(
      updated.tables.requireByName("Node").rowAlive[1]
    ).toBe(false);
  });

  it("supports cyclic cascading updates", () => {
    let table = buildTable({name: "Node"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({
        name: "RefID",
        type: SQL_DECIMAL,
        nullable: true,
      }))
      .createIndex({
        name: "PK_NODE",
        columns: ["ID"],
        unique: true,
      });

    table = table.addRows([
      [1, 2],
      [2, 1],
    ]);

    const db = buildDatabase()
      .addTable(table)
      .createForeignKey(
        "Node",
        {
          name: "FK_NODE_REF",
          columns: ["RefID"],
          reverseIndex: "FKRI_Id",
          parentTable: "Node",
          parentColumns: ["ID"],
          onDelete: "cascade",
          onUpdate: "cascade",
        }
      );

    const updates = [3, 2];

    const updated = db.updateRows(
      "Node", [0], [updates]
    );

    expect(
      updated.tables.requireByName("Node").requireRow(1)
    ).toEqual([2, 3]);
  });

  it("supports composite foreign key cascading updates", () => {
    let parent = buildTable({name: "Parent"})
      .createColumn(createColumnTestSpec({ name: "A", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "B", type: SQL_DECIMAL }))
      .createIndex({
        name: "PK_PARENT",
        columns: ["A", "B"],
        unique: true,
      });

    parent = parent.addRows([
      [1, 2],
    ]);

    let child = buildTable({name: "Child"})
      .createColumn(createColumnTestSpec({ name: "FA", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "FB", type: SQL_DECIMAL }));

    child = child.addRows([
      [1, 2],
    ]);

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey(
        "Child",
        {
          name: "FK_CHILD_PARENT",
          columns: ["FA", "FB"],
          reverseIndex: "FKRI_CHILD",
          parentTable: "Parent",
          parentColumns: ["A", "B"],
          onDelete: "cascade",
          onUpdate: "cascade",
        }
      );
    
    const updates = [10, 20];

    const updated = db.updateRows(
      "Parent", [0], [updates]
    );

    expect(
      updated.tables.requireByName("Child").requireRow(0)
    ).toEqual([10, 20]);
  });

  it("sets all composite foreign key columns to null during SET NULL", () => {
    let parent = buildTable({name: "Parent"})
      .createColumn(createColumnTestSpec({ name: "A", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "B", type: SQL_DECIMAL }))
      .createIndex({
        name: "PK_PARENT",
        columns: ["A", "B"],
        unique: true,
      });

    parent = parent.addRows([
      [1, 2],
    ]);

    let child = buildTable({name: "Child"})
      .createColumn(createColumnTestSpec({
        name: "FA",
        type: SQL_DECIMAL,
        nullable: true,
      }))
      .createColumn(createColumnTestSpec({
        name: "FB",
        type: SQL_DECIMAL,
        nullable: true,
      }));

    child = child.addRows([
      [1, 2],
    ]);

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey(
        "Child",
        {
          name: "FK_CHILD_PARENT",
          columns: ["FA", "FB"],
          reverseIndex: "FKRI_CHILD",
          parentTable: "Parent",
          parentColumns: ["A", "B"],
          onDelete: "setNull",
          onUpdate: "setNull",
        }
      );

    const updated = db.removeRows("Parent", [createDelete(parent, 0)]);

    expect(
      updated.tables.requireByName("Child").requireRow(0)
    ).toEqual([null, null]);
  });

  it("supports multi-level cascade chains", () => {
    let a = buildTable({name: "A"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "PK_A",
        columns: ["ID"],
        unique: true,
      });

    a = a.addRows([
      [1],
    ]);

    let b = buildTable({name: "B"})
      .createColumn(createColumnTestSpec({ name: "AID", type: SQL_DECIMAL }))
      .createIndex({
        name: "PK_B",
        columns: ["AID"],
        unique: true,
      });
    
    b = b.addRows([
      [1],
    ]);

    let c = buildTable({name: "C"})
      .createColumn(createColumnTestSpec({ name: "BID", type: SQL_DECIMAL }));

    c = c.addRows([
      [1],
    ]);

    const db = buildDatabase()
      .addTable(a)
      .addTable(b)
      .addTable(c)
      .createForeignKey(
        "B",
        {
          name: "FK_B_A",
          columns: ["AID"],
          reverseIndex: "FKRI_CHILD",
          parentTable: "A",
          parentColumns: ["ID"],
          onDelete: "cascade",
          onUpdate: "cascade",
        }
      )
      .createForeignKey(
        "C",
        {
          name: "FK_C_B",
          columns: ["BID"],
          reverseIndex: "FKRI_CHILD",
          parentTable: "B",
          parentColumns: ["AID"],
          onDelete: "cascade",
          onUpdate: "cascade",
        }
      );

    const updated = db.removeRows("A", [createDelete(a, 0)]);

    expect(
      updated.tables.requireByName("B").rowAlive[0]
    ).toBe(false);

    expect(
      updated.tables.requireByName("C").rowAlive[0]
    ).toBe(false);
  });

  it("preserves immutable database state during cascading operations", () => {
    let parent = buildTable({name: "Parent"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL, nullable: false }))
      .createIndex({name: "pk_parent", columns: ["id"], unique: true});

    parent = parent.addRows([
      [1],
    ]);

    let child = buildTable({name: "Child"})
      .createColumn(createColumnTestSpec({
        name: "ParentID",
        type: SQL_DECIMAL,
      }));

    child = child.addRows([
      [1],
    ]);

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey(
        "Child",
        {
          name: "FK_CHILD_PARENT",
          columns: ["ParentID"],
          reverseIndex: "FKRI_CHILD",
          parentTable: "Parent",
          parentColumns: ["ID"],
          onDelete: "cascade",
          onUpdate: "cascade",
        }
      );

    const updated = db.removeRows("Parent", [createDelete(parent, 0)]);

    expect(() => {
      db.tables.requireByName("Parent").assertRowAlive(0)
    }).not.toThrow();

    expect(() => {
      db.tables.requireByName("Child").assertRowAlive(0)
    }).not.toThrow();

    expect(
      updated.tables.requireByName("Parent").rowAlive[0]
    ).toBe(false);

    expect(
      updated.tables.requireByName("Child").rowAlive[0]
    ).toBe(false);
  });

  it("handles overlapping propagation paths deterministically", () => {
    /*
      A -> B
      A -> C
      B,C -> D

      deleting A cascades into B and C.
      D references both B and C.

      D must only be deleted once.
    */
    let a = buildTable({name: "A"})
      .createColumn(createColumnTestSpec({
        name: "ID",
        type: SQL_DECIMAL,
        nullable: false
      }))
      .createIndex({
        name: "pk_a",
        columns: ["id"],
        unique: true,
      });

    a = a.addRows([
      [1],
    ]);

    let b = buildTable({name: "B"})
      .createColumn(createColumnTestSpec({
        name: "ID",
        type: SQL_DECIMAL,
        nullable: false
      }))
      .createColumn(createColumnTestSpec({ name: "A_ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "pk_b",
        columns: ["id"],
        unique: true,
      });

    b = b.addRows([
      [10, 1],
    ]);

    let c = buildTable({name: "C"})
      .createColumn(createColumnTestSpec({
        name: "ID",
        type: SQL_DECIMAL,
        nullable: false }))
      .createColumn(createColumnTestSpec({ name: "A_ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "pk_c",
        columns: ["id"],
        unique: true,
      });

    c = c.addRows([
      [20, 1],
    ]);

    let d = buildTable({name: "D"})
      .createColumn(createColumnTestSpec({ name: "B_ID", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C_ID", type: SQL_DECIMAL }));

    d = d.addRows([
      [10, 20],
    ]);

    const db = buildDatabase()
      .addTable(
        a
      )
      .addTable(
        b
      )
      .addTable(
        c
      )
      .addTable(
        d
      )

      .createForeignKey("B", {
        name: "FK_B_A",
        columns: ["A_ID"],
        reverseIndex: "FKRI_CHILD",
        parentTable: "A",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      })

      .createForeignKey("C", {
        name: "FK_C_A",
        columns: ["A_ID"],
        reverseIndex: "FKRI_CHILD",
        parentTable: "A",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      })

      .createForeignKey("D", {
        name: "FK_D_B",
        columns: ["B_ID"],
        reverseIndex: "FKRI_CHILD",
        parentTable: "B",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      })

      .createForeignKey("D", {
        name: "FK_D_C",
        columns: ["C_ID"],
        reverseIndex: "FKRI_CHILD2",
        parentTable: "C",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      });

    const updated = db.removeRows("A", [createDelete(a, 0)]);

    expect(updated.tables.requireByName("A").rowAlive[0]).toBe(false);
    expect(updated.tables.requireByName("B").rowAlive[0]).toBe(false);
    expect(updated.tables.requireByName("C").rowAlive[0]).toBe(false);
    expect(updated.tables.requireByName("D").rowAlive[0]).toBe(false);
  });

  it("converges propagation without stale references", () => {
    /*
      A -> B -> C

      delete A
      delete B
      delete C

      no second pass should fail because
      reverse indexes were updated correctly.
    */

    let a = buildTable({name: "A"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL, nullable: false }))
      .createIndex({
        name: "pk_a",
        columns: ["id"],
        unique: true,
      });

    a = a.addRows([
      [1],
    ]);

    let b = buildTable({name: "B"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL, nullable: false }))
      .createColumn(createColumnTestSpec({ name: "A_ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "pk_b",
        columns: ["id"],
        unique: true,
      });

    b = b.addRows([
      [2, 1],
    ]);

    let c = buildTable({name: "C"})
      .createColumn(createColumnTestSpec({ name: "B_ID", type: SQL_DECIMAL }));

    c = c.addRows([
      [2],
    ]);

    const db = buildDatabase()
      .addTable(
        a
      )
      .addTable(
        b
      )
      .addTable(
        c
      )

      .createForeignKey("B", {
        name: "FK_B_A",
        columns: ["A_ID"],
        reverseIndex: "FKRI_CHILD",
        parentTable: "A",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      })

      .createForeignKey("C", {
        name: "FK_C_B",
        columns: ["B_ID"],
        reverseIndex: "FKRI_CHILD",
        parentTable: "B",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      });

    const updated = db.removeRows("A", [createDelete(a, 0)]);

    expect(updated.tables.requireByName("A").rowAlive[0]).toBe(false);
    expect(updated.tables.requireByName("B").rowAlive[0]).toBe(false);
    expect(updated.tables.requireByName("C").rowAlive[0]).toBe(false);
  });

  it("prevents infinite recursion during cyclic propagation", () => {
    /*
      A -> B
      B -> A

      delete A

      should terminate safely.
    */

    const a = buildTable({name: "A"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL, nullable: false }))
      .createColumn(createColumnTestSpec({ name: "B_ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "pk_a",
        columns: ["id"],
        unique: true,
      });

    const b = buildTable({name: "B"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL, nullable: false }))
      .createColumn(createColumnTestSpec({ name: "A_ID", type: SQL_DECIMAL }))
      .createIndex({
        name: "pk_b",
        columns: ["id"],
        unique: true,
      });

    const db = buildDatabase()
      .addTable(
        a
      )
      .addTable(
        b
      )

      .createForeignKey("A", {
        name: "FK_A_B",
        columns: ["B_ID"],
        reverseIndex: "FKRI_CHILD",
        parentTable: "B",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      })

      .createForeignKey("B", {
        name: "FK_B_A",
        columns: ["A_ID"],
        reverseIndex: "FKRI_CHILD",
        parentTable: "A",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      });

    const tableA_columnA = a.columns.requireIdByName("ID");
    const tableA_columnB = a.columns.requireIdByName("B_ID");

    const tableB_columnA = b.columns.requireIdByName("ID");
    const tableB_columnB = b.columns.requireIdByName("A_ID");

    const withRows = db
      .addRows("A", [new Map<ColumnId, ColumnInput>()
        .set(tableA_columnA, 1)
        .set(tableA_columnB, null)])
      .addRows("B", [new Map<ColumnId, ColumnInput>()
        .set(tableB_columnA, 2)
        .set(tableB_columnB, 1)]);

    const aWithRows = withRows.tables.require(a.id);

    const withUpdate = withRows.updateRows(
      "A", [0], [[1, 2]]
    );

    const updated = withUpdate.removeRows("A", [createDelete(aWithRows, 0)]);

    expect(updated.tables.requireByName("A").rowAlive[0]).toBe(false);
    expect(updated.tables.requireByName("B").rowAlive[0]).toBe(false);
  });

  it("keeps reverse indexes synchronized during cascading deletes", () => {
    let parent = buildTable({name: "Parent"})
      .createColumn(createColumnTestSpec({ name: "ID", type: SQL_DECIMAL, nullable: false }))
      .createIndex({
        name: "pk_parent",
        columns: ["id"],
        unique: true,
      });
    
    parent = parent.addRows([
      [1],
    ]);

    let child = buildTable({name: "Child"})
      .createColumn(createColumnTestSpec({
        name: "PARENT_ID",
        type: SQL_DECIMAL,
      }));

    child = child.addRows([
      [1],
    ]);

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)

      .createForeignKey("Child", {
        name: "FK_CHILD_PARENT",
        columns: ["PARENT_ID"],
        reverseIndex: "FKRI_CHILD",
        parentTable: "Parent",
        parentColumns: ["ID"],
        onDelete: "cascade",
        onUpdate: "restrict",
      });

    const updated = db.removeRows(
      "Parent",
      [createDelete(parent, 0)]
    );

    child = updated.tables.requireByName("Child");

    const reverseIndex =
      child.indexes.requireByName("FKRI_CHILD");

    expect(
      reverseIndex.getRowNumsFromProjection([1])
    ).toEqual(undefined);
  });

});