export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  PHOTOS: R2Bucket;
  SITE_ORIGIN: string;
  MAIL_FROM: string;
  /** 不设置就退回 console 兜底实现，方便本地开发不用申请 Resend key。 */
  RESEND_API_KEY?: string;
  /** 签相册图片/打包下载链接用的 HMAC 密钥，必须设置——本地开发放 .dev.vars。 */
  SIGNING_SECRET: string;
}
