import { Server } from 'http';

export interface NginxConfig {
  server_name: string;
  listen: string;
  root: string;
  locations: NginxLocation[];
  ssl?: NginxSSL;
  enabled: boolean;
  source: 'sites-available' | 'conf.d';
}

export interface NginxLocation {
  path: string;
  proxy_pass?: string;
  proxy_port?: string | null;
  try_files?: string;
  root?: string;
  index?: string[];
  fastcgi_pass?: string;
}

export interface NginxSSL {
  certificate: string;
  certificate_key: string;
  protocols: string[];
}

export interface ServerStatus {
  isRunning: boolean;
  workers: number;
  connections: number;
  requests: number;
  lastReload: Date;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestsPerSecond: number;
}

export interface AccessLogEntry {
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  status: number;
  responseTime: number;
  userAgent: string;
}

export interface TrafficStats {
  requestsPerMinute: number;
  avgResponseTime: number;
  statusCodes: { [key: string]: number };
  topPaths: { path: string; count: number }[];
  topIps: { ip: string; count: number }[];
  currentConnections: number;
  cpuUsage: number;
  memoryUsage: number;
  bandwidthIn: number;
  bandwidthOut: number;
}

export interface RealTimeMetrics {
  timestamp: number;
  activeConnections: number;
  requestsPerSecond: number;
  cpuUsage: number;
  memoryUsage: number;
  bandwidthIn: number;
  bandwidthOut: number;
}