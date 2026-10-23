import { describe, it, expect } from 'vitest';
import { DiscoveryIdentity } from '../../src/mapping/discovery/DiscoveryIdentity.js';
import { DiscoveryResults } from '../../src/mapping/discovery/DiscoveryResults.js';
import { DiscoveryResult } from '../../src/mapping/discovery/DiscoveryResult.js';

describe('Discovery::DiscoveryResults', () => {
  const identity = DiscoveryIdentity.empty();
  const captures = new Map();

  it("creates a root result with a generated ID", () => {
    const results = new DiscoveryResults();

    const result = results.createDiscoveryResult(
      null,
      "registry",
      identity,
      "test-value",
      {},
      captures,
    );

    expect(result.resultId).toBeDefined();
    expect(result.parentResultId).toBeNull();
  });

  it("assigns unique IDs to created results", () => {
    const results = new DiscoveryResults();

    const first = results.createDiscoveryResult(
      null,
      "registry",
      identity,
      "first",
      {},
      captures,
    );

    const second = results.createDiscoveryResult(
      null,
      "registry",
      identity,
      "second",
      {},
      captures,
    );

    expect(first.resultId).not.toBe(second.resultId);
  });

  it("preserves the supplied parent result ID", () => {
    const results = new DiscoveryResults();

    const parent = results.createDiscoveryResult(
      null,
      "registry",
      identity,
      "parent",
      {},
      captures,
    );

    const child = results.createDiscoveryResult(
      parent.resultId,
      "chainDirectory",
      identity,
      "child",
      {},
      captures,
    );

    expect(child.parentResultId).toBe(parent.resultId);
  });

  it("preserves the supplied result data", () => {
    const results = new DiscoveryResults();

    const result = results.createDiscoveryResult(
      null,
      "chainFile",
      identity,
      "test-value",
      {},
      captures,
    );

    expect(result).toBeInstanceOf(DiscoveryResult);
    expect(result.nodeType).toBe("chainFile");
    expect(result.identity).toBe(identity);
    expect(result.value).toBe("test-value");
    expect(result.captures).toBe(captures);
  });
});