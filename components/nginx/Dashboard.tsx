'use client';

import { useEffect, useState } from 'react';
import { ServerIcon, Settings2, Power, RefreshCw, Plus, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NginxConfig, ServerStatus } from '@/lib/types/nginx';
import { toast } from 'sonner';

export default function NginxDashboard() {
  const [configs, setConfigs] = useState<NginxConfig[]>([]);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [newConfig, setNewConfig] = useState<Partial<NginxConfig>>({
    server_name: '',
    listen: '80',
    root: '',
    locations: [],
    enabled: false,
    source: 'sites-available'
  });
  const [showNewConfigDialog, setShowNewConfigDialog] = useState(false);
  const [showSSLDialog, setShowSSLDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [email, setEmail] = useState('');

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/nginx');
      if (!response.ok) {
        throw new Error('Failed to fetch configurations');
      }
      const data = await response.json();
      setConfigs(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch configurations');
      setLoading(false);
      setConfigs([]);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const toggleConfig = async (configName: string, enabled: boolean) => {
    try {
      const action = enabled ? 'disable' : 'enable';
      const response = await fetch('/api/nginx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, configName }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} configuration`);
      }
      
      toast.success(`Configuration ${action}d successfully`);
      fetchConfigs();
    } catch (error) {
      toast.error(`Failed to ${action} configuration`);
    }
  };

  const createConfig = async () => {
    try {
      const response = await fetch('/api/nginx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          config: newConfig,
          source: newConfig.source
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create configuration');
      }
      
      toast.success('Configuration created successfully');
      setShowNewConfigDialog(false);
      setNewConfig({
        server_name: '',
        listen: '80',
        root: '',
        locations: [],
        enabled: false,
        source: 'sites-available'
      });
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to create configuration');
    }
  };

  const generateSSL = async () => {
    try {
      if (!email) {
        toast.error('Email is required for SSL certificate generation');
        return;
      }

      const response = await fetch('/api/nginx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-ssl',
          configName: selectedConfig,
          email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate SSL certificate');
      }
      
      toast.success('SSL certificate generated successfully');
      setShowSSLDialog(false);
      setEmail('');
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to generate SSL certificate');
    }
  };

  const activeConfigs = configs.filter(c => c.enabled).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <ServerIcon className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Server Status</h3>
              <p className="text-sm text-muted-foreground">
                {status?.isRunning ? 'Running' : 'Stopped'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <Settings2 className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Active Configs</h3>
              <p className="text-sm text-muted-foreground">
                {activeConfigs} / {configs.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <Power className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">System Load</h3>
              <p className="text-sm text-muted-foreground">
                {status?.workers || 0} workers
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Server Configurations</h2>
          <div className="space-x-2">
            <Button onClick={fetchConfigs} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowNewConfigDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Config
            </Button>
          </div>
        </div>

        <div className="relative overflow-x-auto">
          {loading ? (
            <div className="text-center py-4">Loading configurations...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-4">No configurations found</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted">
                <tr>
                  <th className="px-6 py-3">Server Name</th>
                  <th className="px-6 py-3">Port</th>
                  <th className="px-6 py-3">Root Directory</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Proxy Ports</th>
                  <th className="px-6 py-3">SSL</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => (
                  <tr key={config.server_name} className="border-b">
                    <td className="px-6 py-4">{config.server_name}</td>
                    <td className="px-6 py-4">{config.listen}</td>
                    <td className="px-6 py-4">{config.root}</td>
                    <td className="px-6 py-4">{config.source}</td>
                    <td className="px-6 py-4">
                      {config.locations
                        .filter(loc => loc.proxy_port)
                        .map(loc => loc.proxy_port)
                        .join(', ') || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {config.ssl ? 'Enabled' : 'Disabled'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          config.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {config.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-x-2">
                        {config.source === 'sites-available' && (
                          <Button
                            variant={config.enabled ? 'destructive' : 'default'}
                            size="sm"
                            onClick={() =>
                              toggleConfig(config.server_name, config.enabled)
                            }
                          >
                            {config.enabled ? 'Disable' : 'Enable'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedConfig(config.server_name);
                            setShowSSLDialog(true);
                          }}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          SSL
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Dialog open={showNewConfigDialog} onOpenChange={setShowNewConfigDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Configuration</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="server_name">Server Name</Label>
              <Input
                id="server_name"
                value={newConfig.server_name}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, server_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="listen">Port</Label>
              <Input
                id="listen"
                value={newConfig.listen}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, listen: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="root">Root Directory</Label>
              <Input
                id="root"
                value={newConfig.root}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, root: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowNewConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createConfig}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSSLDialog} onOpenChange={setShowSSLDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>SSL Certificate Management</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email (required for Let's Encrypt)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowSSLDialog(false)}>
              Cancel
            </Button>
            <Button onClick={generateSSL}>Generate SSL</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}