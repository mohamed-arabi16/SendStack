import { NextResponse } from 'next/server';
import { getStatus, sendMessage, normalizePhone } from '@/lib/whatsapp-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message } = body as { phone?: string; message?: string };

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: phone and message are required.' },
        { status: 400 }
      );
    }

    // Validate phone number format before attempting to send
    let normalized: string;
    try {
      normalized = normalizePhone(phone);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
    }

    const status = getStatus();
    if (status !== 'ready') {
      return NextResponse.json(
        { success: false, error: `WhatsApp client is not ready. Current status: ${status}` },
        { status: 400 }
      );
    }

    const messageId = await sendMessage(normalized, message);
    return NextResponse.json({ success: true, messageId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Classify error type for the frontend
    const lower = message.toLowerCase();
    let errorType: string = 'unknown';
    if (lower.includes('not ready') || lower.includes('disconnected during send')) {
      errorType = 'disconnected';
    } else if (lower.includes('not registered') || lower.includes('invalid wid')) {
      errorType = 'not_on_whatsapp';
    } else if (lower.includes('rate') || lower.includes('spam') || lower.includes('too many')) {
      errorType = 'rate_limited';
    } else if (lower.includes('timeout') || lower.includes('network') || lower.includes('econnreset')) {
      errorType = 'network';
    }

    return NextResponse.json(
      { success: false, error: message, errorType },
      { status: 500 }
    );
  }
}
