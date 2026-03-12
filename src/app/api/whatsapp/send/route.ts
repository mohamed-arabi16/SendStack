import { NextResponse } from 'next/server';
import { getStatus, sendMessage } from '@/lib/whatsapp-client';

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

    const status = getStatus();
    if (status !== 'ready') {
      return NextResponse.json(
        { success: false, error: `WhatsApp client is not ready. Current status: ${status}` },
        { status: 400 }
      );
    }

    // Normalize phone: strip spaces, dashes, parentheses, and leading '+'
    const normalized = phone.replace(/[\s\-\(\)\+]/g, '');

    const messageId = await sendMessage(normalized, message);
    return NextResponse.json({ success: true, messageId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
