export default function logger(text: string): void {
  console.log("\x1b[31m%s\x1b[0m", text);
}
