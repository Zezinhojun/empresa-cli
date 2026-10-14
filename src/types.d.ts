// Os .md são embutidos como texto no bundle (tsup `loader` e plugin do vitest).
declare module '*.md' {
  const content: string;
  export default content;
}
