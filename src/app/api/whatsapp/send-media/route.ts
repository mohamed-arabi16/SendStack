import { NextResponse } from 'next/server';
import { getStatus, sendMedia, normalizePhone } from '@/lib/whatsapp-client';

/** Max file size: 16 MB (WhatsApp limit) */
const MAX_BYTES = 16 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, mediaBase64, mimeType, filename, caption } = body as {
      phone?: string;
      mediaBase64?: string;
      mimeType?: string;
      filename?: string;
      caption?: string;
    };

    if (!phone || !mediaBase64 || !mimeType || !filename) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: phone, mediaBase64, mimeType, and filename are required.' },
        { status: 400 }
      );
    }

    // Validate phone number format
    let normalized: string;
    try {
      normalized = normalizePhone(phone);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${mimeType}. Allowed types: PNG, JPG, GIF, WebP, PDF, DOCX, XLSX.` },
        { status: 400 }
      );
    }

    // Estimate original file size from base64 length (base64 is ~33 % larger than binary)
    const approxBytes = Math.ceil((mediaBase64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is 16 MB.` },
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

    const messageId = await sendMedia(normalized, mediaBase64, mimeType, filename, caption);
    return NextResponse.json({ success: true, messageId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
