import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import readline from 'readline';
import {
  NginxConfig,
  ServerStatus,
  AccessLogEntry,
  TrafficStats,
  RealTimeMetrics
} from './types/nginx';

const execAsync = promisify(exec);

export class NginxManager {
  private configDir: string;
  private sitesAvailable: string;
  private sitesEnabled: string;
  private confD: string;
  private sslDir: string;
  private logDir: string;
  private statusFile: string;
  private metricsInterval: NodeJS.Timeout | null;
  private subscribers: Set<(metrics: RealTimeMetrics) => void>;

  constructor() {
    this.configDir = '/etc/nginx';
    this.sitesAvailable = path.join(this.configDir, 'sites-available');
    this.sitesEnabled = path.join(this.configDir, 'sites-enabled');
    this.confD = path.join(this.configDir, 'conf.d');
    this.sslDir = path.join(this.configDir, 'ssl');
    this.logDir = '/var/log/nginx';
    this.statusFile = '/var/run/nginx/nginx.status';
    this.subscribers = new Set();
    this.metricsInterval = null;
  }

  async listConfigurations(): Promise<NginxConfig[]> {
    try {
      const configs: NginxConfig[] = [];
      
      // Read from sites-available
      const availableFiles = await fs.readdir(this.sitesAvailable);
      for (const file of availableFiles) {
        if (file.endsWith('.conf')) {
          const config = await this.parseConfigFile(
            path.join(this.sitesAvailable, file),
            'sites-available'
          );
          if (config) configs.push(config);
        }
      }

      // Read from conf.d
      const confDFiles = await fs.readdir(this.confD);
      for (const file of confDFiles) {
        if (file.endsWith('.conf')) {
          const config = await this.parseConfigFile(
            path.join(this.confD, file),
            'conf.d'
          );
          if (config) configs.push(config);
        }
      }

      return configs;
    } catch (error) {
      console.error('Error listing configurations:', error);
      return [];
    }
  }

  async enableConfig(configName: string): Promise<void> {
    const sourcePath = path.join(this.sitesAvailable, `${configName}.conf`);
    const targetPath = path.join(this.sitesEnabled, `${configName}.conf`);
    await fs.symlink(sourcePath, targetPath);
    await this.reloadNginx();
  }

  async disableConfig(configName: string): Promise<void> {
    const targetPath = path.join(this.sitesEnabled, `${configName}.conf`);
    await fs.unlink(targetPath);
    await this.reloadNginx();
  }

  async createConfiguration(config: Partial<NginxConfig>, source: string = 'sites-available'): Promise<void> {
    const configContent = this.generateConfigContent(config);
    const targetDir = source === 'sites-available' ? this.sitesAvailable : this.confD;
    await fs.writeFile(
      path.join(targetDir, `${config.server_name}.conf`),
      configContent
    );
    await this.reloadNginx();
  }

  async updateConfiguration(configName: string, config: Partial<NginxConfig>, source: string): Promise<void> {
    const configContent = this.generateConfigContent(config);
    const targetDir = source === 'sites-available' ? this.sitesAvailable : this.confD;
    await fs.writeFile(
      path.join(targetDir, `${configName}.conf`),
      configContent
    );
    await this.reloadNginx();
  }

  async deleteConfiguration(configName: string, source: string): Promise<void> {
    const targetDir = source === 'sites-available' ? this.sitesAvailable : this.confD;
    await fs.unlink(path.join(targetDir, `${configName}.conf`));
    
    // Also remove symlink if it exists
    const symlinkPath = path.join(this.sitesEnabled, `${configName}.conf`);
    try {
      await fs.unlink(symlinkPath);
    } catch (error) {
      // Ignore if symlink doesn't exist
    }
    
    await this.reloadNginx();
  }

  async generateSSL(configName: string, email: string): Promise<void> {
    await execAsync(`certbot --nginx -d ${configName} --email ${email} --agree-tos --non-interactive`);
    await this.reloadNginx();
  }

  async getAccessLogs(limit: number = 1000): Promise<AccessLogEntry[]> {
    try {
      const logFile = path.join(this.logDir, 'access.log');
      const entries: AccessLogEntry[] = [];
      
      const fileStream = createReadStream(logFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        const entry = this.parseLogLine(line);
        if (entry) {
          entries.push(entry);
          if (entries.length >= limit) break;
        }
      }

      return entries.reverse();
    } catch (error) {
      console.error('Failed to read access logs:', error);
      return [];
    }
  }

  async getTrafficStats(minutes: number = 60): Promise<TrafficStats> {
    try {
      const logs = await this.getAccessLogs(10000);
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);
      
      const recentLogs = logs.filter(log => 
        new Date(log.timestamp) > cutoff
      );

      const stats: TrafficStats = {
        requestsPerMinute: recentLogs.length / minutes,
        avgResponseTime: recentLogs.reduce((acc, log) => acc + log.responseTime, 0) / recentLogs.length || 0,
        statusCodes: {},
        topPaths: [],
        topIps: []
      };

      // Calculate status code distribution
      recentLogs.forEach(log => {
        const status = log.status.toString();
        stats.statusCodes[status] = (stats.statusCodes[status] || 0) + 1;
      });

      // Calculate top paths
      const pathCounts = new Map<string, number>();
      recentLogs.forEach(log => {
        pathCounts.set(log.path, (pathCounts.get(log.path) || 0) + 1);
      });
      stats.topPaths = Array.from(pathCounts.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate top IPs
      const ipCounts = new Map<string, number>();
      recentLogs.forEach(log => {
        ipCounts.set(log.ip, (ipCounts.get(log.ip) || 0) + 1);
      });
      stats.topIps = Array.from(ipCounts.entries())
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return stats;
    } catch (error) {
      console.error('Failed to calculate traffic stats:', error);
      return {
        requestsPerMinute: 0,
        avgResponseTime: 0,
        statusCodes: {},
        topPaths: [],
        topIps: []
      };
    }
  }

  async startMetricsCollection(interval: number = 1000): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectRealTimeMetrics();
        this.notifySubscribers(metrics);
      } catch (error) {
        console.error('Failed to collect metrics:', error);
      }
    }, interval);
  }

  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  subscribeToMetrics(callback: (metrics: RealTimeMetrics) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(metrics: RealTimeMetrics): void {
    this.subscribers.forEach(callback => callback(metrics));
  }

  private async collectRealTimeMetrics(): Promise<RealTimeMetrics> {
    const [status, netstat] = await Promise.all([
      this.getNginxStatus(),
      this.getNetworkStats()
    ]);

    return {
      timestamp: Date.now(),
      activeConnections: status.activeConnections,
      requestsPerSecond: status.requestsPerSecond,
      cpuUsage: await this.getCPUUsage(),
      memoryUsage: await this.getMemoryUsage(),
      bandwidthIn: netstat.bandwidthIn,
      bandwidthOut: netstat.bandwidthOut
    };
  }

  private async getNginxStatus(): Promise<{ activeConnections: number; requestsPerSecond: number }> {
    try {
      const { stdout } = await execAsync('nginx -v');
      const activeConnections = parseInt(stdout.match(/Active connections: (\d+)/)?.[1] || '0', 10);
      const requestsPerSecond = parseInt(stdout.match(/(\d+) requests\/sec/)?.[1] || '0', 10);
      
      return { activeConnections, requestsPerSecond };
    } catch (error) {
      return { activeConnections: 0, requestsPerSecond: 0 };
    }
  }

  private async getCPUUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync("ps -p $(pgrep nginx) -o %cpu | awk 'NR>1'");
      return parseFloat(stdout) || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync("ps -p $(pgrep nginx) -o %mem | awk 'NR>1'");
      return parseFloat(stdout) || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getNetworkStats(): Promise<{ bandwidthIn: number; bandwidthOut: number }> {
    try {
      const { stdout } = await execAsync("netstat -i | grep '^eth0'");
      const [, rxBytes, txBytes] = stdout.split(/\s+/);
      return {
        bandwidthIn: parseInt(rxBytes, 10) || 0,
        bandwidthOut: parseInt(txBytes, 10) || 0
      };
    } catch (error) {
      return { bandwidthIn: 0, bandwidthOut: 0 };
    }
  }

  private async reloadNginx(): Promise<void> {
    await execAsync('nginx -s reload');
  }

  private parseLogLine(line: string): AccessLogEntry | null {
    try {
      const regex = /^(\S+) - - \[([^\]]+)\] "(\S+) ([^"]+)" (\d+) (\d+) "([^"]*)" "([^"]*)" (\d+\.\d+)$/;
      const matches = line.match(regex);
      if (!matches) return null;

      return {
        ip: matches[1],
        timestamp: new Date(matches[2].replace(':', ' ')).toISOString(),
        method: matches[3],
        path: matches[4],
        status: parseInt(matches[5], 10),
        responseTime: parseFloat(matches[9]),
        userAgent: matches[8]
      };
    } catch (error) {
      return null;
    }
  }

  private async parseConfigFile(filePath: string, source: string): Promise<NginxConfig | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const serverName = content.match(/server_name\s+([^;]+);/)?.[1]?.trim();
      const listen = content.match(/listen\s+([^;]+);/)?.[1]?.trim();
      const root = content.match(/root\s+([^;]+);/)?.[1]?.trim();
      
      if (!serverName || !listen) return null;

      const config: NginxConfig = {
        server_name: serverName,
        listen,
        root: root || '',
        locations: this.parseLocations(content),
        enabled: await this.isConfigEnabled(serverName),
        source,
        ssl: this.parseSSL(content)
      };

      return config;
    } catch (error) {
      return null;
    }
  }

  private parseLocations(content: string): NginxLocation[] {
    const locations: NginxLocation[] = [];
    const locationBlocks = content.match(/location\s+([^{]+)\s*{[^}]+}/g) || [];

    for (const block of locationBlocks) {
      const path = block.match(/location\s+([^{]+)\s*{/)?.[1]?.trim();
      const proxyPass = block.match(/proxy_pass\s+([^;]+);/)?.[1]?.trim();
      const proxyPort = proxyPass?.match(/:(\d+)/)?.[1] || null;

      if (path) {
        locations.push({
          path,
          proxy_pass: proxyPass,
          proxy_port: proxyPort
        });
      }
    }

    return locations;
  }

  private parseSSL(content: string): NginxSSL | undefined {
    const certificate = content.match(/ssl_certificate\s+([^;]+);/)?.[1]?.trim();
    const certificateKey = content.match(/ssl_certificate_key\s+([^;]+);/)?.[1]?.trim();
    const protocols = content.match(/ssl_protocols\s+([^;]+);/)?.[1]?.trim().split(/\s+/);

    if (certificate && certificateKey && protocols) {
      return {
        certificate,
        certificate_key: certificateKey,
        protocols
      };
    }

    return undefined;
  }

  private async isConfigEnabled(serverName: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.sitesEnabled, `${serverName}.conf`));
      return true;
    } catch {
      return false;
    }
  }

  private generateConfigContent(config: Partial<NginxConfig>): string {
    let content = 'server {\n';
    content += `    listen ${config.listen};\n`;
    content += `    server_name ${config.server_name};\n`;
    
    if (config.root) {
      content += `    root ${config.root};\n`;
    }

    if (config.locations) {
      for (const location of config.locations) {
        content += `    location ${location.path} {\n`;
        if (location.proxy_pass) {
          content += `        proxy_pass ${location.proxy_pass};\n`;
          content += '        proxy_set_header Host $host;\n';
          content += '        proxy_set_header X-Real-IP $remote_addr;\n';
        }
        content += '    }\n';
      }
    }

    content += '}\n';
    return content;
  }
}