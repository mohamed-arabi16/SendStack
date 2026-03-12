import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getQR, getStatus } from '@/lib/whatsapp-client';

export async function GET() {
  try {
    const status = getStatus();
    const qrString = getQR();

    if (!qrString) {
      return NextResponse.json({ qr: null, status });
    }

    const qrDataUrl = await QRCode.toDataURL(qrString);
    return NextResponse.json({ qr: qrDataUrl, status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { qr: null, status: 'disconnected', error: message },
      { status: 500 }
    );
  }
}
