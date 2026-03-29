import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

type SendEmailRequest = {
  to?: string;
  subject?: string;
  html?: string;
  fromEmail?: string;
  smtpConfig?: {
    host?: string;
    port?: number | string;
    user?: string;
    pass?: string;
    fromName?: string;
  };
};

type RouteError = {
  message?: string;
  responseCode?: number;
  code?: number | string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendEmailRequest;
    const { to, subject, html, smtpConfig, fromEmail } = body;

    if (!to || !subject || !html || !smtpConfig) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, html, and smtpConfig are all required.' },
        { status: 200 }
      );
    }

    if (!smtpConfig.user || !smtpConfig.pass) {
      return NextResponse.json(
        { success: false, error: 'Missing SMTP credentials. Both username and app password are required.' },
        { status: 200 }
      );
    }

    const port = Number(smtpConfig.port) || 587;
    const isImplicitTLS = port === 465;

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host || 'smtp.mail.me.com',
      port,
      // Port 465 = implicit SSL/TLS (secure: true)
      // Port 587 = STARTTLS upgrade (secure: false, but requireTLS forces upgrade)
      secure: isImplicitTLS,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      tls: {
        // Required for STARTTLS with some providers
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
      // Force STARTTLS upgrade on port 587
      ...(port === 587 ? { requireTLS: true } : {}),
    });

    // Verify connection configuration
    await transporter.verify();

    const senderEmail = fromEmail || smtpConfig.user;
    const senderName = smtpConfig.fromName || 'Email Sender';

    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: unknown) {
    console.error('Error sending email:', error);

    // Categorize error for better client-side messages
    let errorType = 'unknown';
    const err = (error && typeof error === 'object' ? error : {}) as RouteError;
    const msg = err.message || '';
    const code = err.responseCode || err.code || 0;

    if (msg.includes('Invalid login') || msg.includes('authentication') || code === 535) {
      errorType = 'auth';
    } else if (msg.includes('Mailbox') || msg.includes('recipient') || code === 550) {
      errorType = 'recipient';
    } else if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
      errorType = 'network';
    } else if (msg.includes('rate') || msg.includes('throttl') || code === 421) {
      errorType = 'ratelimit';
    }

    return NextResponse.json(
      {
        success: false,
        error: msg || 'Failed to send email',
        errorType,
        code,
      },
      { status: 200 }
    );
  }
}
