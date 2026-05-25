declare module '@aws-sdk/client-textract' {
  export class TextractClient {
    constructor(config: {
      region: string
      credentials: {
        accessKeyId: string
        secretAccessKey: string
      }
    })
    send(command: DetectDocumentTextCommand): Promise<DetectDocumentTextResponse>
  }

  export interface DetectDocumentTextResponse {
    Blocks?: Array<{
      BlockType?: string
      Text?: string
    }>
  }

  export class DetectDocumentTextCommand {
    constructor(input: {
      Document: {
        Bytes?: Uint8Array
        S3Object?: {
          Bucket: string
          Name: string
        }
      }
    })
  }
}
