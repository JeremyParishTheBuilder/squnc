import { JsonDecoder } from "../../../mapping/discovery/decoding/JsonDecoder.js";
import { DiscoveryNode } from "../../../mapping/discovery/DiscoveryNode.js";
import { DiscoveryRoot } from "../../../mapping/discovery/DiscoveryRoot.js";
import { DirectoryNavigator } from "../../../mapping/discovery/navigation/DirectoryNavigator.js";
import { SelfNavigator } from "../../../mapping/discovery/navigation/SelfNavigator.js";
import { StructuredArrayNavigator } from "../../../mapping/discovery/navigation/StructuredArrayNavigator.js";
import { StructuredObjectNavigator } from "../../../mapping/discovery/navigation/StructuredObjectNavigator.js";
import { Directory } from "../../../mapping/discovery/nodejs/Directory.js";
import { FsDiscoverySource } from "../../../mapping/discovery/nodejs/FsDiscoverySource.js";
import {
  basename,
  capture,
  concat,
  json_value,
  literal,
  payload,
  propertyName,
} from "../../../mapping/dsl/expression/functions.js";
import {
  contains,
  every,
  isDirectory,
  isFile,
  isNull,
  some,
} from "../../../mapping/dsl/predicate/functions.js";

export const testRegistry_DiscoveryDefinition = () => {
  // const logoUrisNode = new DiscoveryNode({
  //   navigator: new StructuredObjectNavigator(),
  //   matcher: propertyName().eq("logo_URIs"),
  //   nodeType: "LogoUris",
  //   children: [],
  // });

  const assetNode = new DiscoveryNode({
    navigator: new StructuredArrayNavigator(),
    matcher: isNull(literal(null)),
    nodeType: "asset",
    captures: {
      base: json_value(payload(), "$.base"),
      owner: concat(
        literal("Asset:"),
        json_value(capture("chain"), "$"),
        literal(":"),
        json_value(payload(), "$.base"),
      ),
    },
    children: [],
  });

  const assetsArrayNode = new DiscoveryNode({
    navigator: new StructuredObjectNavigator(),
    matcher: propertyName().eq("assets"),
    nodeType: "assetsArrayNode",
    children: [assetNode],
  });

  const assetlistFileNode = new DiscoveryNode({
    navigator: new DirectoryNavigator(),
    matcher: every(isFile(), basename().eq("assetlist.json")),
    decoder: new JsonDecoder(),
    nodeType: "assetlistFile",
    children: [assetsArrayNode],
  });

  // const imagesDirectoryNode = new DiscoveryNode({
  //   navigator: new DirectoryNavigator(),
  //   matcher: every(isDirectory(), basename().eq("images")),
  //   nodeType: "chainFile",
  //   children: [/*imageFileNode*/],
  // });

  const chainFileNode = new DiscoveryNode({
    navigator: new DirectoryNavigator(),
    matcher: every(isFile(), basename().eq("chain.json")),
    decoder: new JsonDecoder(),
    nodeType: "chainFile",
    captures: {
      owner: concat(literal("Chain:"), json_value(capture("chain"), "$")),
    },
    children: [],
  });

  const chainCollection = new DiscoveryNode({
    navigator: new DirectoryNavigator(),
    matcher: contains(
      some(
        every(isFile(), basename().eq("chain.json")),
        every(isFile(), basename().eq("assetlist.json")),
      ),
    ),
    children: [chainFileNode, assetlistFileNode],
    nodeType: "chainDirectory",
    captures: {
      chain: basename(),
    },
  });

  const cosmosScope = new DiscoveryNode({
    matcher: isDirectory(),
    navigator: new SelfNavigator(Directory),
    children: [chainCollection],
    nodeType: "networkType",
    captures: {
      networkType: literal("Cosmos"),
    },
  });

  const nonCosmosScope = new DiscoveryNode({
    navigator: new DirectoryNavigator(),
    matcher: every(isDirectory(), basename().eq("_non-cosmos")),
    children: [chainCollection],
    nodeType: "networkType",
    captures: {
      networkType: literal("Non-cosmos"),
    },
  });

  const mainnetScope = new DiscoveryNode({
    navigator: new SelfNavigator(Directory),
    matcher: isDirectory(),
    children: [cosmosScope, nonCosmosScope],
    nodeType: "networkKind",
    captures: {
      networkKind: literal("Mainnet"),
    },
  });

  const testnetScope = new DiscoveryNode({
    navigator: new DirectoryNavigator(),
    matcher: every(isDirectory(), basename().eq("testnets")),
    children: [cosmosScope, nonCosmosScope],
    nodeType: "networkKind",
    captures: {
      networkKind: literal("Testnet"),
    },
  });

  const testRegistryDiscoveryNode = new DiscoveryNode({
    navigator: new SelfNavigator(Directory),
    matcher: isDirectory(),
    captures: {
      registryName: literal("Test Cosmos Chain Registry"),
    },
    children: [mainnetScope, testnetScope],
    nodeType: "registry",
  });

  const registryRootDirectory = new Directory("./external/testRegistry");

  const testRegistryRootDirectory = new FsDiscoverySource(
    registryRootDirectory,
  );

  const testRegistryDiscoveryRoot = new DiscoveryRoot(
    testRegistryRootDirectory,
    testRegistryDiscoveryNode,
  );

  return testRegistryDiscoveryRoot;
};
