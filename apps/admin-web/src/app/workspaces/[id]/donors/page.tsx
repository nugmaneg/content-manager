'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, Source, WorkspaceDonor } from '@/lib/api';

export default function WorkspaceDonorsPage() {
    const { id } = useParams();
    const { token } = useAuth();
    const [donors, setDonors] = useState<WorkspaceDonor[]>([]);
    const [availableSources, setAvailableSources] = useState<Source[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        if (token && id) {
            loadData();
        }
    }, [token, id]);

    async function loadData() {
        if (!token || !id) return;

        setIsLoading(true);
        try {
            const [donorsData, sourcesData] = await Promise.all([
                api.getWorkspaceDonors(token, id as string),
                api.getSources(token, { limit: 100 }),
            ]);
            setDonors(donorsData);

            // Filter out sources that are already donors
            const donorSourceIds = new Set(donorsData.map(d => d.source_id));
            setAvailableSources(sourcesData.items.filter(s => !donorSourceIds.has(s.id)));
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function toggleDonorActive(donor: WorkspaceDonor) {
        if (!token || !id) return;

        try {
            await api.updateWorkspaceDonor(token, id as string, donor.source_id, { isActive: !donor.is_active });
            loadData();
        } catch (error) {
            console.error('Failed to update donor:', error);
        }
    }

    async function removeDonor(sourceId: string) {
        if (!token || !id || !confirm('Remove this source from workspace?')) return;

        try {
            await api.removeWorkspaceDonor(token, id as string, sourceId);
            loadData();
        } catch (error) {
            console.error('Failed to remove donor:', error);
        }
    }

    async function addDonor(sourceId: string) {
        if (!token || !id) return;

        try {
            await api.addWorkspaceDonor(token, id as string, sourceId);
            setShowAddModal(false);
            loadData();
        } catch (error) {
            console.error('Failed to add donor:', error);
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href={`/workspaces/${id}`} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Content Donors</h1>
                        <p className="text-slate-400">Manage sources feeding content to this workspace</p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={() => setShowAddModal(true)} disabled={availableSources.length === 0}>
                        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Donor
                    </Button>
                </div>

                {/* Donors List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : donors.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                            </svg>
                            <h3 className="mt-4 text-lg font-medium text-white">No donors yet</h3>
                            <p className="mt-2 text-slate-400">Add sources to start receiving content.</p>
                            {availableSources.length > 0 ? (
                                <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                                    Add Donor
                                </Button>
                            ) : (
                                <p className="mt-4 text-sm text-slate-500">
                                    <Link href="/sources" className="text-indigo-400 hover:text-indigo-300">Create some sources</Link> first.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {donors.map((donor) => (
                            <Card key={donor.id} hover>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl">
                                                {donor.source_type === 'telegram' ? '📱' :
                                                    donor.source_type === 'twitter' ? '🐦' :
                                                        donor.source_type === 'rss' ? '📰' : '🌐'}
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-white">{donor.source_name || donor.source_external_id}</h3>
                                                <p className="text-sm text-slate-400">{donor.source_type}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleDonorActive(donor)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${donor.is_active ? 'bg-indigo-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${donor.is_active ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                        <span>Added {new Date(donor.created_at).toLocaleDateString()}</span>
                                        <button
                                            onClick={() => removeDonor(donor.source_id)}
                                            className="text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                            <CardHeader className="flex items-center justify-between flex-shrink-0">
                                <h2 className="text-lg font-semibold text-white">Add Donor Source</h2>
                                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </CardHeader>
                            <CardContent className="overflow-y-auto p-0">
                                {availableSources.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400">
                                        All sources are already added to this workspace.
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-slate-800">
                                        {availableSources.map((source) => (
                                            <li key={source.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg">
                                                        {source.type === 'telegram' ? '📱' :
                                                            source.type === 'twitter' ? '🐦' : '🌐'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{source.name || source.external_id}</p>
                                                        <p className="text-xs text-slate-500">{source.type}</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" onClick={() => addDonor(source.id)}>
                                                    Add
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
