import { NextResponse } from 'next/server';
import { NginxManager } from '@/lib/nginx';

const nginx = new NginxManager();

export async function GET() {
  try {
    const configs = await nginx.listConfigurations();
    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, configName, config, ssl, source, email } = body;
    
    switch (action) {
      case 'enable':
        await nginx.enableConfig(configName);
        break;
      case 'disable':
        await nginx.disableConfig(configName);
        break;
      case 'create':
        await nginx.createConfiguration(config, source);
        break;
      case 'update':
        await nginx.updateConfiguration(configName, config, source);
        break;
      case 'delete':
        await nginx.deleteConfiguration(configName, source);
        break;
      case 'generate-ssl':
        await nginx.generateSSL(configName, email);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}