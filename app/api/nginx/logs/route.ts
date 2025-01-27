import { NextResponse } from 'next/server';
import { NginxManager } from '@/lib/nginx';

const nginx = new NginxManager();

export async function GET() {
  try {
    const logs = await nginx.getAccessLogs();
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}