import { NextResponse } from 'next/server';
import { disconnect } from '@/lib/whatsapp-client';

export async function POST() {
  try {
    await disconnect();
    return NextResponse.json({ status: 'disconnected' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'error', error: message },
      { status: 500 }
    );
  }
}
