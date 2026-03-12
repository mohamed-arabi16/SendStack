import { NextResponse } from 'next/server';
import { getStatus, getClientInfo, autoInit } from '@/lib/whatsapp-client';

export async function GET() {
  try {
    // Trigger auto-reconnect when a persisted session exists but the client
    // is disconnected (e.g., after a server restart).
    autoInit();

    const status = getStatus();
    const info = getClientInfo();

    return NextResponse.json({
      status,
      ...(info ? { phone: info.wid, name: info.pushname } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'disconnected', error: message },
      { status: 500 }
    );
  }
}
