import { Engine } from "./Engine.js";
import { Dialect } from "../dialect/Dialect.js";

export class EngineRegistry {
  private static engineRegistry: EngineRegistry;
  public static getInstance(): EngineRegistry {
    if (!this.engineRegistry) {
      this.engineRegistry = new EngineRegistry();
    }
    return this.engineRegistry;
  }

  private engines = new Map<string, Engine>();
  private _currentDefaultEngine: string | undefined = undefined;

  public engine(name: string | undefined = this._currentDefaultEngine): Engine {
    if (!name) {
      throw new Error(`No engine specified. Given name: ${name}`);
    }
    const engine = this.engines.get(name);
    if (!engine) {
      throw new Error(`Engine ${name} not found`);
    }
    return engine;
  }

  public newEngine(
    name: string = "DEFAULT",
    dialect: Dialect = Dialect.Postgres,
  ) {
    if (this.engines.has(name)) {
      throw new Error(`Engine ${name} already exists`);
    }
    this.engines.set(name, Engine.create(dialect));
    if (!this._currentDefaultEngine) {
      this.setDefaultEngine(name);
    }
  }

  public setDefaultEngine(name: string) {
    if (!this.engines.has(name)) {
      throw new Error(`Engine ${name} not found`);
    }
    this._currentDefaultEngine = name;
  }
}
