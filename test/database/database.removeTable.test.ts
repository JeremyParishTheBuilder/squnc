import { describe, it, expect } from 'vitest';
import {
  buildDatabase,
  createColumnTestSpec,
  createForeignKeyTestSpec_Database
} from '../utils/buildSchema.js';
import { SQL_DECIMAL } from '../../src/types/SqlType.js';

describe('Database::removeTable', () => {
  it('removes a table from the database', () => {
    const database = buildDatabase()
      .createTable({name: "T1"});

    const updated = database.removeTable("T1");

    expect(() => {
      updated.tables.requireByName("T1");
    }).toThrow();
  });

  it('does not mutate original database (immutability)', () => {
    const database = buildDatabase()
      .createTable({name: "T1"});

    const updated = database.removeTable("T1");

    expect(database.tables.requireByName("T1")).toBeDefined();

    expect(() => {
      updated.tables.requireByName("T1");
    }).toThrow();
  });

  it('throws when table is referenced by a foreign key', () => {
    const database = buildDatabase()
      .createTable({name: "Users"})
      .createTable({name: "Posts"});
      
    const users = database.tables.requireByName("Users")
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      }))
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      });

    const posts = database.tables.requireByName("Posts")
      .createColumn(createColumnTestSpec({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      }));

    const updated = database
      .updateTable(users)
      .updateTable(posts)
      .createForeignKey(
        "posts",
        createForeignKeyTestSpec_Database({
          name: "FK_Posts_Users",
          columns: ["UserId"],
          reverseIndex: "FKRI_Posts",
          parentTable: "Users",
          parentColumns: ["Id"],
        }
      ));

    expect(() => {
      updated.removeTable("Users");
    }).toThrow();
  });
});