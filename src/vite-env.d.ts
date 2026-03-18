/// <reference types="vite/client" />

declare module '*.njk' {
  const content: string;
  export default content;
}

declare module 'to-ico' {
  function toIco(images: Buffer[]): Promise<Buffer>;
  export default toIco;
}
