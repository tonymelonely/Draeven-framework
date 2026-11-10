/* Types for Node's built-in zlib. Core does not take a dependency on @types/node. */

declare module "node:zlib" {
  export function deflateSync(data: Uint8Array): Uint8Array;
  export function inflateSync(data: Uint8Array): Uint8Array;
}
