import { describe, it, expect } from 'vitest';
import {
  buildDatabase,
  buildTable,
} from '../utils/buildSchema.js';
import { SQL_DECIMAL, SQL_VARCHAR } from '../../src/types/SqlType.js';

describe("Database::alterColumn", () => {

  it("rejects altering a parent column to an incompatible type", () => {
    const users = buildTable({ name: "Users" })
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

    const posts = buildTable({ name: "Posts" })
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts)
      .createForeignKey(
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
      database.alterColumn(
        "Users",
        "Id",
        SQL_VARCHAR
      );
    }).toThrow();
  });

  it("rejects altering a child column to an incompatible type", () => {
    // identical setup
    const users = buildTable({ name: "Users" })
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

    const posts = buildTable({ name: "Posts" })
      .createColumn({
        name: "UserId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts)
      .createForeignKey(
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
      database.alterColumn(
        "Posts",
        "UserId",
        SQL_VARCHAR
      );
    }).toThrow();
  });

  it("matches corresponding columns in a composite foreign key", () => {
    const users = buildTable({ name: "Users" })
      .createColumn({
        name: "FirstId",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createColumn({
        name: "SecondId",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createIndex({
        name: "PK_Users",
        columns: ["FirstId", "SecondId"],
        unique: true,
      });

    const posts = buildTable({ name: "Posts" })
      .createColumn({
        name: "UserFirstId",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createColumn({
        name: "UserSecondId",
        type: SQL_DECIMAL,
        nullable: false,
      });

    const database = buildDatabase()
      .addTable(users)
      .addTable(posts)
      .createForeignKey(
        "Posts",
        {
          name: "FK_Posts_Users",
          columns: ["UserFirstId", "UserSecondId"],
          reverseIndex: "FKRI",
          parentTable: "Users",
          parentColumns: ["FirstId", "SecondId"],
        }
      );

    expect(() => {
      database.alterColumn(
        "Users",
        "SecondId",
        SQL_VARCHAR
      );
    }).toThrow();
  });

});