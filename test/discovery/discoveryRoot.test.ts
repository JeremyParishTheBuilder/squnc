import { describe, it, expect } from 'vitest';
import { DiscoveryResults } from '../../src/mapping/discovery/DiscoveryResults.js';

import { DiscoveryRoot } from '../../src/mapping/discovery/DiscoveryRoot.js';
import { DiscoveryNode } from '../../src/mapping/discovery/DiscoveryNode.js';
import { Directory } from '../../src/mapping/discovery/nodejs/Directory.js';
import { DirectoryNavigator } from '../../src/mapping/discovery/navigation/DirectoryNavigator.js';
import { SelfNavigator } from '../../src/mapping/discovery/navigation/SelfNavigator.js';
import { FsDiscoverySource } from '../../src/mapping/discovery/nodejs/FsDiscoverySource.js';
import type { FsObject } from '../../src/mapping/discovery/nodejs/FsObject.js';
import { isDirectory } from '../../src/mapping/dsl/predicate/functions.js';

class TestDirectory extends Directory {
  constructor(
    fullPath: string,
    private readonly testContents: FsObject[] = [],
  ) {
    super(fullPath);
  }

  override get contents(): FsObject[] {
    return this.testContents;
  }
}

describe('Discovery::DiscoveryRoot', () => {
  it("creates a flat result registry with hierarchical parent relationships", () => {
    const leafA = new TestDirectory("/root/a");
    const leafB = new TestDirectory("/root/b");
    const rootDirectory = new TestDirectory("/root", [leafA, leafB]);

    const childNode = new DiscoveryNode({
      nodeType: "child",
      navigator: new DirectoryNavigator(),
      matcher: isDirectory(),
      children: [],
    });

    const rootNode = new DiscoveryNode({
      nodeType: "root",
      navigator: new SelfNavigator(Directory),
      matcher: isDirectory(),
      children: [childNode],
    });

    const root = new DiscoveryRoot(
      new FsDiscoverySource(rootDirectory),
      rootNode,
    );

    const results = root.discover();
    const discovered = results.getAll();

    expect(results).toBeInstanceOf(DiscoveryResults);
    expect(discovered).toHaveLength(3);

    const rootResult = discovered.find(
      (result) => result.nodeType === "root",
    );

    expect(rootResult).toBeDefined();
    expect(rootResult!.parentResultId).toBeNull();

    const childResults = discovered.filter(
      (result) => result.nodeType === "child",
    );

    expect(childResults).toHaveLength(2);

    for (const child of childResults) {
      expect(child.parentResultId).toBe(rootResult!.resultId);
    }

    expect(new Set(discovered.map((result) => result.resultId)).size).toBe(
      discovered.length,
    );
  });

  it("assigns the immediate parent to nested results", () => {
    const leaf = new TestDirectory("/root/branch/leaf");
    const branch = new TestDirectory("/root/branch", [leaf]);
    const rootDirectory = new TestDirectory("/root", [branch]);

    const leafNode = new DiscoveryNode({
      nodeType: "leaf",
      navigator: new DirectoryNavigator(),
      matcher: isDirectory(),
      children: [],
    });

    const branchNode = new DiscoveryNode({
      nodeType: "branch",
      navigator: new DirectoryNavigator(),
      matcher: isDirectory(),
      children: [leafNode],
    });

    const rootNode = new DiscoveryNode({
      nodeType: "root",
      navigator: new SelfNavigator(Directory),
      matcher: isDirectory(),
      children: [branchNode],
    });

    const root = new DiscoveryRoot(
      new FsDiscoverySource(rootDirectory),
      rootNode,
    );

    const discovered = root.discover().getAll();

    expect(discovered).toHaveLength(3);

    const rootResult = discovered.find(
      (result) => result.nodeType === "root",
    );
    const branchResult = discovered.find(
      (result) => result.nodeType === "branch",
    );
    const leafResult = discovered.find(
      (result) => result.nodeType === "leaf",
    );

    expect(rootResult).toBeDefined();
    expect(branchResult).toBeDefined();
    expect(leafResult).toBeDefined();

    expect(rootResult!.parentResultId).toBeNull();
    expect(branchResult!.parentResultId).toBe(rootResult!.resultId);
    expect(leafResult!.parentResultId).toBe(branchResult!.resultId);
  });
});