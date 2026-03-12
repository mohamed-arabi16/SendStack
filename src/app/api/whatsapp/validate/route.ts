import { NextResponse } from 'next/server';
import { isRegisteredUser, getStatus } from '@/lib/whatsapp-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phones } = body as { phones?: string[] };

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: phones must be a non-empty array.' },
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

    const results = await Promise.all(
      phones.map(async (phone) => {
        const normalized = phone.replace(/[\s\-\(\)\+]/g, '');
        const valid = await isRegisteredUser(normalized);
        return { phone: normalized, valid };
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
