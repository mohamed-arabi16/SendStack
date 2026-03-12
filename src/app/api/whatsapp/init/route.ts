import { NextResponse } from 'next/server';
import { getStatus, initialize } from '@/lib/whatsapp-client';

export async function POST() {
  try {
    const currentStatus = getStatus();

    if (currentStatus === 'ready') {
      return NextResponse.json({ status: 'already_connected' });
    }

    if (currentStatus === 'qr') {
      return NextResponse.json({ status: 'initializing' });
    }

    // Fire off initialization asynchronously — the QR/ready events will update state
    initialize().catch((err: Error) => {
      console.error('[WhatsApp] Initialization error:', err);
    });

    return NextResponse.json({ status: 'initializing' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'error', error: message },
      { status: 500 }
    );
  }
}
