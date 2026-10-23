import { type ColumnValue, isColumnValue } from "../../types/ColumnValue.js";
import { toPascalCase } from "../../utils/format.js";
import { type DiscoveryResult } from "../discovery/DiscoveryResult.js";
//import type { CaptureValue } from "../value/CaptureValue.js";
import {
  isStructuredValue,
  type StructuredValue,
} from "../value/StructuredValue.js";
import { type ValueResolverContext } from "../value/ValueResolverContext.js";
import { ImportContext } from "./ImportContext.js";
import { ImportMapping } from "./ImportMapping.js";
import { ImportResult } from "./ImportResult.js";
import { InferredImport } from "./InferredImport.js";

// export class ObjectImporter {
//   import(discovery: DiscoveryResult, mapping: ImportMapping): ImportResult[] {
//     const context = new ImportContext(
//       discovery,
//       discovery.identity,
//       discovery.value,
//     );

//     return this.importInternal(context, mapping);
//   }

//   importInternal(
//     context: ImportContext,
//     mapping: ImportMapping,
//   ): ImportResult[] {
//     const results: ImportResult[] = [];

//     const contexts = mapping.source?.navigate(context) ?? [context];

//     for (const childContext of contexts) {
//       results.push(...this.importObject(childContext, mapping));
//     }

//     return results;
//   }

//   private importObject(
//     context: ImportContext,
//     mapping?: ImportMapping,
//   ): ImportResult[] {
//     const results: ImportResult[] = [];

//     const source = context.source;

//     if (!isStructuredValue(source)) {
//       throw new Error("Import source must be structured.");
//     }

//     const currentNamespace = mapping
//       ? this.currentNamespace(context, mapping)
//       : [];

//     const inferredChildren = this.inferChildren(context, source);

//     const excludedProperties = new Set<string>([
//       ...(mapping?.children.flatMap(
//         (child) => child.source?.consumedKeys() ?? [],
//       ) ?? []),
//     ]);

//     const tableName = mapping?.tableName ?? context.tableName;

//     if (!isStructuredValue(source)) {
//       throw new Error("Import source must be structured.");
//     }

//     const values = new Map<string, ColumnValue>();

//     if (
//       source !== null &&
//       typeof source === "object" &&
//       !Array.isArray(source) &&
//       mapping?.flatten !== false
//     ) {
//       this.flattenColumns(values, currentNamespace, source, excludedProperties);
//     }

//     const rowIdentity =
//       tableName === context.tableName
//         ? context.identity
//         : context.discovery.identity;

//     const resolverContext: ValueResolverContext = {
//       current: source,
//       captures: context.discovery.captures,
//       capture(name: string): CaptureValue {
//         const value = context.discovery.captures.get(name);

//         if (value === undefined) {
//           throw new Error(`Missing capture '${name}'.`);
//         }

//         return value;
//       },
//       rowIdentity,
//     };

//     for (const [name, builder] of Object.entries(mapping?.fields ?? {})) {
//       values.set(
//         this.qualifyColumn(currentNamespace, name),
//         builder.evaluate(resolverContext),
//       );
//     }

//     if (tableName) {
//       results.push(new ImportResult(tableName, rowIdentity, values));
//     }

//     let nextContext = context.withIdentity(rowIdentity);

//     if (mapping?.tableName) {
//       nextContext = nextContext.withTable(mapping.tableName);
//     }

//     if (mapping) {
//       results.push(...this.importChildren(nextContext, mapping));
//     }

//     for (const inferred of inferredChildren) {
//       results.push(...this.importObject(inferred.context, inferred.mapping));
//     }

//     return results;
//   }

//   private importChildren(
//     context: ImportContext,
//     mapping: ImportMapping,
//   ): ImportResult[] {
//     const results: ImportResult[] = [];

//     for (const childMapping of mapping.children) {
//       results.push(...this.importInternal(context, childMapping));
//     }

//     return results;
//   }

//   private flattenColumns(
//     values: Map<string, ColumnValue>,
//     namespace: readonly string[],
//     value: StructuredValue,
//     excludedProperties: ReadonlySet<string>,
//     path: string[] = [],
//   ): void {
//     const fullNamespace = [...namespace, ...path.map(toPascalCase)];

//     if (isColumnValue(value)) {
//       values.set(fullNamespace.join("."), value);
//       return;
//     }

//     if (Array.isArray(value)) {
//       return;
//     }

//     if (value !== null && typeof value === "object") {
//       for (const [key, child] of Object.entries(value)) {
//         if (path.length === 0 && excludedProperties.has(key)) {
//           continue;
//         }

//         path.push(key);

//         this.flattenColumns(values, namespace, child, excludedProperties, path);

//         path.pop();
//       }
//     }
//   }

//   private qualifyColumn(namespace: readonly string[], name: string): string {
//     const parts = [...namespace, toPascalCase(name)];

//     return parts.join(".");
//   }

//   private currentNamespace(
//     context: ImportContext,
//     mapping: ImportMapping,
//   ): readonly string[] {
//     if (mapping.prefix) {
//       return [mapping.prefix];
//     }

//     if (context.tableName !== mapping.tableName) {
//       return [];
//     }

//     const columnNamespace = mapping.source?.columnNamespace();

//     return columnNamespace ? [columnNamespace] : [];
//   }

//   private inferChildren(
//     context: ImportContext,
//     value: StructuredValue,
//     path: readonly string[] = [],
//   ): InferredImport[] {
//     const results: InferredImport[] = [];

//     if (value == null || typeof value !== "object" || Array.isArray(value)) {
//       return results;
//     }

//     for (const [propertyName, child] of Object.entries(value)) {
//       if (Array.isArray(child)) {
//         child.forEach((element, index) => {
//           results.push({
//             context: new ImportContext(
//               context.discovery,
//               context.identity.append(index),
//               element,
//               toPascalCase(propertyName),
//             ),
//             mapping: new ImportMapping({
//               tableName: toPascalCase(propertyName),
//               flatten: true,
//             }),
//           });
//         });
//       } else if (child != null && typeof child === "object") {
//         results.push(
//           ...this.inferChildren(context, child, [
//             ...path,
//             toPascalCase(propertyName),
//           ]),
//         );
//       }
//     }

//     return results;
//   }
// }
