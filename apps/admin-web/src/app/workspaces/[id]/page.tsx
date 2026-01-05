'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, Workspace, WorkspaceDonor, Target } from '@/lib/api';

export default function WorkspaceDetailPage() {
    const { id } = useParams();
    const { token } = useAuth();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [donors, setDonors] = useState<WorkspaceDonor[]>([]);
    const [targets, setTargets] = useState<Target[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (token && id) {
            loadData();
        }
    }, [token, id]);

    async function loadData() {
        if (!token || !id) return;

        setIsLoading(true);
        try {
            const [workspaceData, donorsData, targetsData] = await Promise.all([
                api.getWorkspace(token, id as string),
                api.getWorkspaceDonors(token, id as string),
                api.getTargets(token, id as string),
            ]);
            setWorkspace(workspaceData);
            setDonors(donorsData);
            setTargets(targetsData.targets);
        } catch (error) {
            console.error('Failed to load workspace:', error);
        } finally {
            setIsLoading(false);
        }
    }

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            </DashboardLayout>
        );
    }

    if (!workspace) {
        return (
            <DashboardLayout>
                <Card>
                    <CardContent className="py-12 text-center">
                        <h3 className="text-lg font-medium text-white">Workspace not found</h3>
                        <Link href="/workspaces" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300">
                            Back to workspaces
                        </Link>
                    </CardContent>
                </Card>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/workspaces" className="text-slate-400 hover:text-white transition-colors">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                        </svg>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-white font-bold text-xl">
                                {workspace.name[0].toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">{workspace.name}</h1>
                            <p className="text-slate-400">Created {new Date(workspace.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card hover>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Donors</p>
                                    <p className="text-2xl font-bold text-white">{donors.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card hover>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Active Donors</p>
                                    <p className="text-2xl font-bold text-white">{donors.filter(d => d.is_active).length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card hover>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Targets</p>
                                    <p className="text-2xl font-bold text-white">{targets.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Donors */}
                    <Card>
                        <CardHeader className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Content Donors</h2>
                            <Link href={`/workspaces/${id}/donors`}>
                                <Button size="sm">Manage</Button>
                            </Link>
                        </CardHeader>
                        <CardContent className="p-0">
                            {donors.length === 0 ? (
                                <div className="p-6 text-center text-slate-400">No donors added yet</div>
                            ) : (
                                <ul className="divide-y divide-slate-800">
                                    {donors.slice(0, 5).map((donor) => (
                                        <li key={donor.id} className="px-6 py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg">
                                                    {donor.source_type === 'telegram' ? '📱' :
                                                        donor.source_type === 'twitter' ? '🐦' : '🌐'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{donor.source_name || donor.source_external_id}</p>
                                                    <p className="text-xs text-slate-500">{donor.source_type}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 text-xs rounded-full ${donor.is_active
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                {donor.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* Targets */}
                    <Card>
                        <CardHeader className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Publication Targets</h2>
                            <Link href={`/workspaces/${id}/targets`}>
                                <Button size="sm">Manage</Button>
                            </Link>
                        </CardHeader>
                        <CardContent className="p-0">
                            {targets.length === 0 ? (
                                <div className="p-6 text-center text-slate-400">No targets added yet</div>
                            ) : (
                                <ul className="divide-y divide-slate-800">
                                    {targets.slice(0, 5).map((target) => (
                                        <li key={target.id} className="px-6 py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg">
                                                    {target.type === 'telegram' ? '📱' :
                                                        target.type === 'twitter' ? '🐦' : '🌐'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">{target.name || target.external_id}</p>
                                                    <p className="text-xs text-slate-500">{target.type}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 text-xs rounded-full ${target.is_active
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                {target.is_active ? 'Active' : 'Inactive'}
                                            </span>
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
