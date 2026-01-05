'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, Source, CreateSourceData, SyncResult } from '@/lib/api';

export default function SourcesPage() {
    const { token } = useAuth();
    const [sources, setSources] = useState<Source[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

    useEffect(() => {
        if (token) {
            loadSources();
        }
    }, [token, filter, typeFilter]);

    async function loadSources() {
        if (!token) return;

        setIsLoading(true);
        try {
            const response = await api.getSources(token, {
                limit: 50,
                activeOnly: filter === 'active',
                type: typeFilter || undefined,
            });
            setSources(filter === 'inactive'
                ? response.items.filter(s => !s.is_active)
                : response.items
            );
            setTotal(response.total);
        } catch (error) {
            console.error('Failed to load sources:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function toggleActive(source: Source) {
        if (!token) return;

        try {
            await api.setSourceActive(token, source.id, !source.is_active);
            loadSources();
        } catch (error) {
            console.error('Failed to toggle source:', error);
        }
    }

    async function deleteSource(id: string) {
        if (!token || !confirm('Are you sure you want to delete this source?')) return;

        try {
            await api.deleteSource(token, id);
            loadSources();
        } catch (error) {
            console.error('Failed to delete source:', error);
        }
    }

    async function syncSource(source: Source) {
        if (!token || source.type !== 'telegram') return;

        setSyncingSourceId(source.id);
        setSyncResult(null);

        try {
            const result = await api.syncSource(token, source.id, 10);
            setSyncResult(result);
        } catch (error) {
            console.error('Failed to sync source:', error);
            alert(error instanceof Error ? error.message : 'Sync failed');
        } finally {
            setSyncingSourceId(null);
        }
    }

    const sourceTypes = ['telegram', 'twitter', 'rss', 'youtube', 'instagram'];

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Sources</h1>
                        <p className="mt-1 text-slate-400">Manage content sources ({total} total)</p>
                    </div>
                    <Button onClick={() => setShowCreateModal(true)}>
                        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Source
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex gap-4">
                    <div className="flex rounded-lg bg-slate-800/50 p-1">
                        {(['all', 'active', 'inactive'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${filter === f
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Types</option>
                        {sourceTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                {/* Sources Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : sources.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                            </svg>
                            <h3 className="mt-4 text-lg font-medium text-white">No sources found</h3>
                            <p className="mt-2 text-slate-400">Get started by adding your first source.</p>
                            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                                Add Source
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sources.map((source) => (
                            <Card key={source.id} hover>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl">
                                                {source.type === 'telegram' ? '📱' :
                                                    source.type === 'twitter' ? '🐦' :
                                                        source.type === 'rss' ? '📰' :
                                                            source.type === 'youtube' ? '📺' :
                                                                source.type === 'instagram' ? '📸' : '🌐'}
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-white">{source.name || source.external_id}</h3>
                                                <p className="text-sm text-slate-400">{source.type}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleActive(source)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${source.is_active ? 'bg-indigo-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${source.is_active ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {source.description && (
                                        <p className="mt-3 text-sm text-slate-400 line-clamp-2">{source.description}</p>
                                    )}

                                    <div className="mt-4 flex items-center justify-between text-xs">
                                        <span className="text-slate-500">ID: {source.external_id}</span>
                                        <div className="flex items-center gap-3">
                                            {source.type === 'telegram' && (
                                                <button
                                                    onClick={() => syncSource(source)}
                                                    disabled={syncingSourceId === source.id}
                                                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                                                >
                                                    {syncingSourceId === source.id ? (
                                                        <>
                                                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                            </svg>
                                                            Syncing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                            </svg>
                                                            Sync
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteSource(source.id)}
                                                className="text-red-400 hover:text-red-300 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Create Modal */}
                {showCreateModal && (
                    <CreateSourceModal
                        onClose={() => setShowCreateModal(false)}
                        onCreated={() => {
                            setShowCreateModal(false);
                            loadSources();
                        }}
                    />
                )}

                {/* Sync Result Modal */}
                {syncResult && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <Card className="w-full max-w-md">
                            <CardHeader className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">Sync Complete</h2>
                                <button onClick={() => setSyncResult(null)} className="text-slate-400 hover:text-white">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-emerald-400">{syncResult.contentCreated}</div>
                                        <div className="text-xs text-slate-400">Created</div>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-slate-400">{syncResult.contentSkipped}</div>
                                        <div className="text-xs text-slate-400">Skipped</div>
                                    </div>
                                </div>

                                <div className="text-sm text-slate-300">
                                    <p>Source: <span className="text-white">{syncResult.sourceName}</span></p>
                                    <p>Messages processed: <span className="text-white">{syncResult.messagesProcessed}</span></p>
                                    <p>Duration: <span className="text-white">{syncResult.durationMs}ms</span></p>
                                </div>

                                {syncResult.errors.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-sm font-medium text-red-400 mb-1">Errors ({syncResult.errors.length}):</p>
                                        <div className="max-h-24 overflow-y-auto bg-red-950/30 rounded-lg p-2">
                                            {syncResult.errors.map((err, i) => (
                                                <p key={i} className="text-xs text-red-300">{err}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Button className="w-full mt-4" onClick={() => setSyncResult(null)}>
                                    Close
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

function CreateSourceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<CreateSourceData>({
        type: 'telegram',
        externalId: '',
        name: '',
        description: '',
        url: '',
        language: 'ru',
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!token) return;

        setError('');
        setIsLoading(true);

        try {
            await api.createSource(token, formData);
            onCreated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create source');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-lg">
                <CardHeader className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Add New Source</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="telegram">Telegram</option>
                                <option value="twitter">Twitter</option>
                                <option value="rss">RSS</option>
                                <option value="youtube">YouTube</option>
                                <option value="instagram">Instagram</option>
                            </select>
                        </div>

                        <Input
                            label="External ID"
                            placeholder={formData.type === 'telegram' ? 'Channel username or ID' : 'Source identifier'}
                            value={formData.externalId}
                            onChange={(e) => setFormData({ ...formData, externalId: e.target.value })}
                            required
                        />

                        <Input
                            label="Name (optional)"
                            placeholder="Display name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        <Input
                            label="Description (optional)"
                            placeholder="Brief description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />

                        <Input
                            label="URL (optional)"
                            placeholder="https://..."
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        />

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1" isLoading={isLoading}>
                                Create Source
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
