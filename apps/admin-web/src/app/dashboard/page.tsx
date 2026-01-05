'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, Source, Workspace } from '@/lib/api';

interface Stats {
    sources: number;
    workspaces: number;
    activeSources: number;
}

export default function DashboardPage() {
    const { token } = useAuth();
    const [stats, setStats] = useState<Stats>({ sources: 0, workspaces: 0, activeSources: 0 });
    const [recentSources, setRecentSources] = useState<Source[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (token) {
            loadData();
        }
    }, [token]);

    async function loadData() {
        if (!token) return;

        try {
            const [sourcesResponse, workspacesResponse] = await Promise.all([
                api.getSources(token, { limit: 5 }),
                api.getWorkspaces(token),
            ]);

            setRecentSources(sourcesResponse.items);
            setWorkspaces(workspacesResponse);
            setStats({
                sources: sourcesResponse.total,
                workspaces: workspacesResponse.length,
                activeSources: sourcesResponse.items.filter(s => s.is_active).length,
            });
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const statCards = [
        {
            label: 'Total Sources',
            value: stats.sources,
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                </svg>
            ),
            color: 'from-blue-500 to-cyan-500',
        },
        {
            label: 'Active Sources',
            value: stats.activeSources,
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            ),
            color: 'from-green-500 to-emerald-500',
        },
        {
            label: 'Workspaces',
            value: stats.workspaces,
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
            ),
            color: 'from-purple-500 to-pink-500',
        },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="mt-2 text-slate-400">Overview of your content management system</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {statCards.map((stat) => (
                        <Card key={stat.label} hover>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white`}>
                                        {stat.icon}
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400">{stat.label}</p>
                                        <p className="text-2xl font-bold text-white">
                                            {isLoading ? '...' : stat.value}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Sources */}
                    <Card>
                        <CardHeader>
                            <h2 className="text-lg font-semibold text-white">Recent Sources</h2>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-6 text-center text-slate-400">Loading...</div>
                            ) : recentSources.length === 0 ? (
                                <div className="p-6 text-center text-slate-400">No sources yet</div>
                            ) : (
                                <ul className="divide-y divide-slate-800">
                                    {recentSources.map((source) => (
                                        <li key={source.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                                                    <span className="text-lg">
                                                        {source.type === 'telegram' ? '📱' :
                                                            source.type === 'twitter' ? '🐦' :
                                                                source.type === 'rss' ? '📰' : '🌐'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        {source.name || source.external_id}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{source.type}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 text-xs rounded-full ${source.is_active
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                {source.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* Workspaces */}
                    <Card>
                        <CardHeader>
                            <h2 className="text-lg font-semibold text-white">Your Workspaces</h2>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-6 text-center text-slate-400">Loading...</div>
                            ) : workspaces.length === 0 ? (
                                <div className="p-6 text-center text-slate-400">No workspaces yet</div>
                            ) : (
                                <ul className="divide-y divide-slate-800">
                                    {workspaces.map((workspace) => (
                                        <li key={workspace.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                                    <span className="text-white font-medium">
                                                        {workspace.name[0].toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{workspace.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Created {new Date(workspace.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
