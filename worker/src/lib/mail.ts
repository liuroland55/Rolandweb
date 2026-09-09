// sendMail() 抽象：生产环境走 Resend HTTP API，本地开发没配 RESEND_API_KEY 时
// 退回 console 实现——直接把链接打在 wrangler dev 的终端里，不用真的注册邮件服务也能跑通登录流程。
import type { Env } from '../env';

export interface Mailer {
  send(to: string, subject: string, html: string): Promise<void>;
}

function consoleMailer(): Mailer {
  return {
    async send(to, subject, html) {
      console.log(`[mail:console] to=${to} subject=${JSON.stringify(subject)}\n${html}`);
    },
  };
}

function resendMailer(env: Env): Mailer {
  return {
    async send(to, subject, html) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: env.MAIL_FROM, to, subject, html }),
      });
      if (!res.ok) {
        console.error(`[mail:resend] failed status=${res.status} body=${await res.text()}`);
      }
    },
  };
}

export function createMailer(env: Env): Mailer {
  return env.RESEND_API_KEY ? resendMailer(env) : consoleMailer();
}

export function magicLinkEmail(loginUrl: string): { subject: string; html: string } {
  return {
    subject: '你的登录链接（10 分钟内有效）',
    html: `<p>点击下面的链接登录，十分钟内有效，用过一次就失效：</p><p><a href="${loginUrl}">${loginUrl}</a></p><p>如果这不是你本人操作，忽略这封邮件即可。</p>`,
  };
}

export function inviteEmail(joinUrl: string, groupName: string): { subject: string; html: string } {
  return {
    subject: `邀请你加入「${groupName}」`,
    html: `<p>这是一条一次性邀请链接，用来加入分组「${groupName}」：</p><p><a href="${joinUrl}">${joinUrl}</a></p>`,
  };
}
