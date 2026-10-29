import type { DiscoveryNode } from "./DiscoveryNode.js";

export function collectNodeTypes(node: DiscoveryNode): Set<string> {
  const nodeTypes = new Set<string>();

  function visit(current: DiscoveryNode): void {
    nodeTypes.add(current.spec.nodeType);

    for (const child of current.spec.children) {
      visit(child);
    }
  }

  visit(node);

  return nodeTypes;
}
