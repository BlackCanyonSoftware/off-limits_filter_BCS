import type { DirEntry, FileSystemView } from "../../src/core/isolation.js";

/** A link, written as `{ linksTo: "/where/it/points" }`. */
export interface LinkNode {
  linksTo: string;
}

/** A file system written as nested objects: an object is a folder, a string a file. */
export interface Tree {
  [name: string]: Tree | string | LinkNode;
}

type Node = Tree | string | LinkNode;

const isLink = (node: Node | undefined): node is LinkNode =>
  typeof node === "object" && "linksTo" in node && typeof node.linksTo === "string";

const isFolder = (node: Node | undefined): node is Tree =>
  typeof node === "object" && !isLink(node);

export function fakeFileSystem(tree: Tree): FileSystemView {
  const find = (path: string): Node | undefined => {
    let node: Node | undefined = tree;
    for (const part of path.split("/").filter((p) => p !== "")) {
      if (!isFolder(node) || !(part in node)) return undefined;
      node = node[part];
    }
    return node;
  };
  return {
    list(directory): DirEntry[] | undefined {
      const node = find(directory);
      if (!isFolder(node)) return undefined;
      return Object.entries(node).map(([name, child]) => ({
        name,
        isDirectory: isFolder(child),
        linkTarget: isLink(child) ? child.linksTo : undefined,
      }));
    },
    exists: (path) => find(path) !== undefined,
    isDirectory: (path) => isFolder(find(path)),
  };
}
