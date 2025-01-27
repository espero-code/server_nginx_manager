'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TrafficStats, RealTimeMetrics, NginxConfig } from '@/lib/types/nginx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SiteMetrics from './SiteMetrics';

export default function Stats() {
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [timeRange, setTimeRange] = useState('60');
  const [loading, setLoading] = useState(true);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealTimeMetrics[]>([]);
  const [configs, setConfigs] = useState<NginxConfig[]>([]);

  const fetchStats = async () => {
    try {
      const [statsResponse, configsResponse] = await Promise.all([
        fetch(`/api/nginx/stats?minutes=${timeRange}`),
        fetch('/api/nginx')
      ]);

      if (!statsResponse.ok || !configsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [statsData, configsData] = await Promise.all([
        statsResponse.json(),
        configsResponse.json()
      ]);

      setStats(statsData);
      setConfigs(configsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [timeRange]);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/api/nginx/realtime`);
    
    ws.onmessage = (event) => {
      const metric = JSON.parse(event.data);
      setRealtimeMetrics(prev => [...prev.slice(-60), metric]);
    };

    return () => ws.close();
  }, []);

  if (loading) {
    return <div className="text-center py-4">Chargement des statistiques...</div>;
  }

  if (!stats) {
    return <div className="text-center py-4">Aucune statistique disponible</div>;
  }

  const statusData = Object.entries(stats.statusCodes).map(([code, count]) => ({
    code,
    count,
  }));

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
        <TabsTrigger value="sites">Sites</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid gap-6">
          <div className="flex justify-end">
            <div className="w-48">
              <Label htmlFor="timeRange">Période</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 dernières minutes</SelectItem>
                  <SelectItem value="30">30 dernières minutes</SelectItem>
                  <SelectItem value="60">Dernière heure</SelectItem>
                  <SelectItem value="360">6 dernières heures</SelectItem>
                  <SelectItem value="1440">24 dernières heures</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Codes de Statut</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="code" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Chemins les Plus Visités</h3>
              <div className="space-y-2">
                {stats.topPaths.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm truncate max-w-[70%]">{item.path}</span>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Adresses IP les Plus Actives</h3>
              <div className="space-y-2">
                {stats.topIps.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm">{item.ip}</span>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Performances</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Requêtes par Minute</p>
                  <p className="text-2xl font-bold">{stats.requestsPerMinute.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Temps de Réponse Moyen</p>
                  <p className="text-2xl font-bold">{stats.avgResponseTime.toFixed(2)}ms</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="sites">
        <div className="grid gap-6">
          {configs.map((config) => (
            <SiteMetrics
              key={config.server_name}
              config={config}
              metrics={realtimeMetrics}
            />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}