import type { EnginePolicy } from "./EnginePolicy.js";
import { ENGINE_RULES } from "./EngineRules.js";
import type { Dialect } from "../dialect/Dialect.js";

export class RuleResolver {
  private cache = new Map<string, unknown>();

  constructor(
    private dialect: Dialect,
    private policy: Partial<EnginePolicy>,
  ) {}

  get<
    D extends keyof typeof ENGINE_RULES,
    K extends keyof (typeof ENGINE_RULES)[D],
  >(domain: D, rule: K): (typeof ENGINE_RULES)[D][K]["engineDefault"] {
    const cacheKey = `${domain}.${String(rule)}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(
        cacheKey,
      ) as (typeof ENGINE_RULES)[D][K]["engineDefault"];
    }

    const spec = ENGINE_RULES[domain][rule];

    const dialectStrict = spec.dialectStrict?.(this.dialect);

    const policyValue = (
      this.policy?.[domain] as
        Record<typeof rule, typeof spec.engineDefault> | undefined
    )?.[rule];

    const dialectDefault = spec.dialectDefault?.(this.dialect);

    const value =
      dialectStrict !== undefined
        ? dialectStrict
        : policyValue !== undefined
          ? policyValue
          : dialectDefault !== undefined
            ? dialectDefault
            : spec.engineDefault;

    this.cache.set(cacheKey, value);

    return value;
  }

  set<
    D extends keyof typeof ENGINE_RULES,
    K extends keyof (typeof ENGINE_RULES)[D],
  >(
    domain: D,
    rule: K,
    value: (typeof ENGINE_RULES)[D][K]["engineDefault"],
  ): void {
    const domainPolicy = {
      ...(this.policy[domain] as Record<string, unknown> | undefined),
      [rule]: value,
    };

    this.policy = {
      ...this.policy,
      [domain]: domainPolicy,
    } as Partial<EnginePolicy>;

    this.invalidate();
  }

  updatePolicy(update: Partial<EnginePolicy>) {
    this.policy = {
      ...this.policy,
      ...Object.fromEntries(
        Object.entries(update).map(([domain, values]) => [
          domain,
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(this.policy as Record<string, any>)[domain],
            ...(values as Record<string, unknown>),
          },
        ]),
      ),
    } as Partial<EnginePolicy>;

    this.invalidate();
  }

  invalidate() {
    this.cache.clear();
  }
}
