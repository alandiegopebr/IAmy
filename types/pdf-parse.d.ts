declare module 'pdf-parse' {
  function pdfParse(data: Buffer | Uint8Array | ArrayBuffer): Promise<{ text?: string; info?: any; metadata?: any }>;
  export default pdfParse;
}
