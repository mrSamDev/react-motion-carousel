export default function logger(text: string): void {
  console.log("\x1b[34m%s\x1b[0m", text);
}
