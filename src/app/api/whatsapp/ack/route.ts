import { NextResponse } from 'next/server';
import { getAllAcks } from '@/lib/whatsapp-client';

/**
 * GET /api/whatsapp/ack
 *
 * Returns the latest ACK level for all tracked message IDs.
 * ACK levels:
 *   0 = Pending (clock icon)
 *   1 = Sent – server received (✓)
 *   2 = Delivered – recipient received (✓✓)
 *   3 = Read – recipient opened (✓✓ blue)
 */
export async function GET() {
  try {
    const acks = getAllAcks();
    return NextResponse.json({ acks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ acks: {}, error: message }, { status: 500 });
  }
}
