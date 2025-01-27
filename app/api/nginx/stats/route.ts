import { NextResponse } from 'next/server';
import { NginxManager } from '@/lib/nginx';

const nginx = new NginxManager();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minutes = parseInt(searchParams.get('minutes') || '60', 10);
    const stats = await nginx.getTrafficStats(minutes);
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}