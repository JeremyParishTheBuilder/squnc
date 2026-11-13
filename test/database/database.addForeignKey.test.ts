import { describe, it, expect } from 'vitest';
import {
  buildDatabase,
  buildParentChildDatabase,
  buildTable,
  createColumnTestSpec,
  createForeignKeyTestSpec_Database
} from '../utils/buildSchema.js';
import { SQL_DECIMAL, SQL_VARCHAR } from '../../src/types/SqlType.js';

describe('Database::createForeignKey', () => {
  it('adds a foreign key to the child table', () => {
    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    const updated = database.createForeignKey(
      "Posts",
      {
        name: "FK_Posts_Users",
        columns: ["UserId"],
        reverseIndex: "FKRI",
        parentTable: "Users",
        parentColumns: ["Id"],
      },
    );

    expect(
      updated
        .tables.requireByName("Posts")
        .foreignKeys.requireByName("FK_Posts_Users")
    ).toBeDefined();
  });

  it('does not mutate original database (immutability)', () => {
    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    const updated = database.createForeignKey(
      "Posts",
      {
        name: "FK_Posts_Users",
        columns: ["UserId"],
        reverseIndex: "FKRI",
        parentTable: "Users",
        parentColumns: ["Id"],
      }
    );

    expect(() => {
      database
        .tables.requireByName("Posts")
        .foreignKeys.requireByName("FK_Posts_Users");
    }).toThrow();

    expect(
      updated
        .tables.requireByName("Posts")
        .foreignKeys.requireByName("FK_Posts_Users")
    ).toBeDefined();
  });

  it('does not mutate parent table', () => {
    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    const originalParent =
      database.tables.requireByName("Users");

    const updated = database.createForeignKey(
      "Posts",
      {
        name: "FK_Posts_Users",
        columns: ["UserId"],
        reverseIndex: "FKRI",
        parentTable: "Users",
        parentColumns: ["Id"],
      }
    );

    expect(
      updated.tables.requireByName("Users")
    ).toBe(originalParent);
  });

  it('throws when child table does not exist', () => {
    const database = buildDatabase();

    expect(() => {
      database.createForeignKey(
        "MissingTable",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["Id"],
        }
      );
    }).toThrow();
  });

  it('throws when parent table does not exist', () => {
    const database = buildDatabase();

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "MissingTable",
          parentColumns: ["Id"],
        }
      );
    }).toThrow();
  });

  it('throws when child columns do not exist', () => {
    const database = buildDatabase();

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["MissingColumn"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["Id"],
        }
      );
    }).toThrow();
  });

  it('throws when parent columns do not exist', () => {
    const database = buildDatabase();

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["MissingColumn"],
        }
      );
    }).toThrow();
  });

  it('throws when parent columns are not uniquely indexed', () => {
    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: false,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["Id"],
        }
      );
    }).toThrow();
  });

  it('throws when child and parent column counts differ', () => {
    const users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({name: "Id"}))
      .createColumn(createColumnTestSpec({name: "Id2"}))
      .createIndex({
        name: "PK_Users2",
        columns: ["Id", "Id2"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createIndex({
        name: "FKRI",
        columns: ["UserID"],
        unique: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["Id", "Id2"],
        }
      );
    }).toThrow();
  });

  it('throws when child and parent column types differ', () => {
    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_VARCHAR,
        nullable: false,
      })
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["Id"],
        }
      );
    }).toThrow();
  });

  it('supports case-insensitive table and column references', () => {
    let database = buildDatabase();

    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .addRows(
        [[1]]
      )
      .createIndex({
        name: "ui1",
        columns: ["Id"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    database = database
      .addTable(users)
      .addTable(posts);

    const updated = database.createForeignKey("postS", createForeignKeyTestSpec_Database({
        name: "fK2",
        columns: ["uSeRiD"],
        reverseIndex: "rI1",
        parentTable: "useRs",
        parentColumns: ["iD"],
      }));

    expect(
      updated
        .tables.requireByName("Posts")
        .foreignKeys.requireByName("fk2")
    ).toBeDefined();
  });

  it('throws when foreign key name already exists', () => {
    const database = buildParentChildDatabase();

    expect(() => {
      database.createForeignKey("Child", createForeignKeyTestSpec_Database({
        name: "fk1",
      }));
    }).toThrow();
  });

  it("throws when existing child rows violate the foreign key", () => {
    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .addRows(
        [[1]]
      )
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .addRows(
        [[999]]
      );

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["Id"],
        }
      );
    }).toThrow();
  });

  it("allows adding a foreign key when existing child rows are valid", () => {
    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .addRows(
        [[1]]
      )
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .addRows(
        [[1]]
      );

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["Id"],
        }
      );
    }).not.toThrow();
  });

  it("ignores existing rows with null foreign key components", () => {
    const users = buildTable({name: "Users"})
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      });

    const posts = buildTable({name: "Posts"})
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: true,
      })
      .addRows(
        [[null]]
      );

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts);

    expect(() => {
      database.createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["Id"],
        }
      );
    }).not.toThrow();
  });
});