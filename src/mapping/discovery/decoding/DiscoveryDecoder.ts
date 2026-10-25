import type { DiscoveryValue } from "../../value/DiscoveryValue.js";
import type { StructuredValue } from "../../value/StructuredValue.js";

export interface DiscoveryDecoder<TIn extends DiscoveryValue> {
  accepts(value: DiscoveryValue): value is TIn;
  decode(value: TIn): DecodeResult;
}

export type DecodeResult =
  | {
      readonly status: "success";
      readonly value: StructuredValue;
    }
  | {
      readonly status: "failed";
      readonly operation: "read" | "decode";
      readonly message: string;
    };
