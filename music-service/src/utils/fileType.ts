export function extensionFromMimeType(mimeType: string): string {
  return mimeType.split("/")[1]?.replace("x-", "") ?? "bin";
}
