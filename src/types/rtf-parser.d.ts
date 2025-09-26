declare module 'rtf-parser' {
  export class RTFParser {
    constructor()
    on(event: 'text', callback: (text: string) => void): void
    on(event: 'end', callback: () => void): void
    on(event: 'error', callback: (error: Error) => void): void
    write(buffer: Buffer): void
    end(): void
  }
}
