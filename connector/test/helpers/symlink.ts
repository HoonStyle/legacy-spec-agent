import { symlinkSync } from "node:fs";

interface SkippableTestContext { skip(message?: string): void }

/** Run symlink security checks where supported without failing before their assertions on locked-down Windows hosts. */
export function symlinkOrSkip(
  t: SkippableTestContext,
  target: string,
  path: string,
  type: Parameters<typeof symlinkSync>[2],
): boolean {
  try {
    symlinkSync(target, path, type);
    return true;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
    if (code !== "EPERM") throw error;
    t.skip("host does not grant permission to create the test symlink");
    return false;
  }
}
