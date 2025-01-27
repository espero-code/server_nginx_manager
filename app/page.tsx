import { Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NginxDashboard from '@/components/nginx/Dashboard';
import LogViewer from '@/components/nginx/LogViewer';
import Stats from '@/components/nginx/Stats';

export default function Home() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Nginx Server Manager</h1>
      
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <Suspense fallback={<div>Loading...</div>}>
            <NginxDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="logs">
          <Suspense fallback={<div>Loading...</div>}>
            <LogViewer />
          </Suspense>
        </TabsContent>

        <TabsContent value="stats">
          <Suspense fallback={<div>Loading...</div>}>
            <Stats />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}