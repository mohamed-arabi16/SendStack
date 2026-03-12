import { NextResponse } from 'next/server';
import { getStatus, getClientInfo } from '@/lib/whatsapp-client';

export async function GET() {
  try {
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
