'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NginxConfig, RealTimeMetrics } from '@/lib/types/nginx';

interface SiteMetricsProps {
  config: NginxConfig;
  metrics: RealTimeMetrics[];
}

export default function SiteMetrics({ config, metrics }: SiteMetricsProps) {
  const [selectedMetric, setSelectedMetric] = useState('connections');

  const metricOptions = [
    { value: 'connections', label: 'Connexions Actives' },
    { value: 'requests', label: 'Requêtes par Seconde' },
    { value: 'cpu', label: 'Utilisation CPU' },
    { value: 'memory', label: 'Utilisation Mémoire' },
    { value: 'bandwidth', label: 'Bande Passante' }
  ];

  const renderChart = () => {
    switch (selectedMetric) {
      case 'connections':
        return (
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <Line
              type="monotone"
              dataKey="activeConnections"
              stroke="hsl(var(--chart-1))"
              name="Connexions Actives"
            />
          </LineChart>
        );

      case 'requests':
        return (
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <Line
              type="monotone"
              dataKey="requestsPerSecond"
              stroke="hsl(var(--chart-2))"
              name="Requêtes/s"
            />
          </LineChart>
        );

      case 'cpu':
        return (
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <Line
              type="monotone"
              dataKey="cpuUsage"
              stroke="hsl(var(--chart-3))"
              name="CPU %"
            />
          </LineChart>
        );

      case 'memory':
        return (
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <Line
              type="monotone"
              dataKey="memoryUsage"
              stroke="hsl(var(--chart-4))"
              name="Mémoire %"
            />
          </LineChart>
        );

      case 'bandwidth':
        return (
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <Line
              type="monotone"
              dataKey="bandwidthIn"
              stroke="hsl(var(--chart-1))"
              name="Entrée (bytes/s)"
            />
            <Line
              type="monotone"
              dataKey="bandwidthOut"
              stroke="hsl(var(--chart-2))"
              name="Sortie (bytes/s)"
            />
          </LineChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold">{config.server_name}</h3>
          <p className="text-sm text-muted-foreground">
            Port: {config.listen} | Status: {config.enabled ? 'Actif' : 'Inactif'}
          </p>
        </div>
        <div className="w-48">
          <Label>Métrique</Label>
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une métrique" />
            </SelectTrigger>
            <SelectContent>
              {metricOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}